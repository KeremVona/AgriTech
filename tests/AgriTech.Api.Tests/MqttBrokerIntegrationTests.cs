using System.Buffers;
using AgriTech.Api.Configuration;
using AgriTech.Api.Messaging;
using AgriTech.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MQTTnet;
using MQTTnet.Formatter;
using MQTTnet.Protocol;
using Xunit;

namespace AgriTech.Api.Tests;

/// <summary>
/// Live integration tests against the Eclipse Mosquitto 2.0 Docker broker (agritech_mqtt on 127.0.0.1:1883).
/// Tagged with Category=Integration so CI environments without Docker can exclude via `--filter Category!=Integration`.
/// Validates BACK-304 acceptance criteria:
///   1. Broker runs with authenticated access on port 1883 (rejects anonymous connections).
///   2. Least-privilege Mosquitto ACLs enforce topic boundaries per role (backend vs simulator).
///   3. Backend establishes persistent wildcard subscription to agri/telemetry/# and receives parcel telemetry.
///   4. Backend dispatches valve actuation commands on agri/actuator/{parcelId}/valve received by simulator.
/// </summary>
[Trait("Category", "Integration")]
public class MqttBrokerIntegrationTests
{
    private const string BrokerHost = "127.0.0.1";
    private const int BrokerPort = 1883;
    private const string BackendUser = "agritech_backend";
    private const string BackendPass = "agritech_backend_dev_pwd";
    private const string SimulatorUser = "agritech_simulator";
    private const string SimulatorPass = "agritech_simulator_dev_pwd";

    [Fact]
    public async Task MosquittoBroker_RejectsAnonymousConnection()
    {
        using var anonClient = new MqttClientFactory().CreateMqttClient();
        var options = new MqttClientOptionsBuilder()
            .WithClientId($"test-anon-{Guid.NewGuid():N}")
            .WithTcpServer(BrokerHost, BrokerPort)
            .WithProtocolVersion(MqttProtocolVersion.V500)
            .WithTimeout(TimeSpan.FromSeconds(5))
            .Build();

        // Mosquitto configured with allow_anonymous false must reject anonymous clients
        var result = await anonClient.ConnectAsync(options);
        Assert.NotEqual(MqttClientConnectResultCode.Success, result.ResultCode);
        Assert.False(anonClient.IsConnected);
    }

    [Fact]
    public async Task MosquittoBroker_EnforcesLeastPrivilegeAclRules()
    {
        var parcelId = Guid.NewGuid();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));

        // 1. agritech_simulator MUST NOT be able to publish valve commands on agri/actuator/{parcelId}/valve
        using var simClient = new MqttClientFactory().CreateMqttClient();
        var simConnect = await simClient.ConnectAsync(new MqttClientOptionsBuilder()
            .WithClientId($"acl-sim-{Guid.NewGuid():N}")
            .WithTcpServer(BrokerHost, BrokerPort)
            .WithProtocolVersion(MqttProtocolVersion.V500)
            .WithCredentials(SimulatorUser, SimulatorPass)
            .Build(), cts.Token);
        Assert.Equal(MqttClientConnectResultCode.Success, simConnect.ResultCode);

        var forbiddenValvePub = await simClient.PublishAsync(new MqttApplicationMessageBuilder()
            .WithTopic(MqttTopics.ValveActuatorForParcel(parcelId))
            .WithPayload("{\"action\":\"VALVE_TRIGGER_OPEN\"}")
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build(), cts.Token);
        Assert.Equal(MqttClientPublishReasonCode.NotAuthorized, forbiddenValvePub.ReasonCode);

        // 2. agritech_simulator MUST NOT receive telemetry packets when subscribing to agri/telemetry/#
        // (Mosquitto 2.0 enforces read ACLs at message delivery time for wildcard subscriptions)
        int simulatorReceivedTelemetryCount = 0;
        simClient.ApplicationMessageReceivedAsync += _ =>
        {
            Interlocked.Increment(ref simulatorReceivedTelemetryCount);
            return Task.CompletedTask;
        };

        await simClient.SubscribeAsync(new MqttClientSubscribeOptionsBuilder()
            .WithTopicFilter(f => f
                .WithTopic(MqttTopics.TelemetryWildcard)
                .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce))
            .Build(), cts.Token);

        var allowedTelemetryPub = await simClient.PublishAsync(new MqttApplicationMessageBuilder()
            .WithTopic(MqttTopics.TelemetryForParcel(parcelId))
            .WithPayload("{\"probe\":\"acl-read-check\"}")
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build(), cts.Token);
        Assert.True(allowedTelemetryPub.IsSuccess);

        await Task.Delay(500, cts.Token);
        Assert.Equal(0, Volatile.Read(ref simulatorReceivedTelemetryCount));

        await simClient.DisconnectAsync(cancellationToken: cts.Token);

        // 3. agritech_backend MUST NOT be able to publish forged telemetry on agri/telemetry/{parcelId}
        using var backendClient = new MqttClientFactory().CreateMqttClient();
        var backendConnect = await backendClient.ConnectAsync(new MqttClientOptionsBuilder()
            .WithClientId($"acl-backend-{Guid.NewGuid():N}")
            .WithTcpServer(BrokerHost, BrokerPort)
            .WithProtocolVersion(MqttProtocolVersion.V500)
            .WithCredentials(BackendUser, BackendPass)
            .Build(), cts.Token);
        Assert.Equal(MqttClientConnectResultCode.Success, backendConnect.ResultCode);

        var forbiddenTelemetryPub = await backendClient.PublishAsync(new MqttApplicationMessageBuilder()
            .WithTopic(MqttTopics.TelemetryForParcel(parcelId))
            .WithPayload("{}")
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build(), cts.Token);
        Assert.Equal(MqttClientPublishReasonCode.NotAuthorized, forbiddenTelemetryPub.ReasonCode);

        await backendClient.DisconnectAsync(cancellationToken: cts.Token);
    }

    [Fact]
    public async Task MqttClientService_EstablishesPersistentWildcardSubscriptionAndExchangesMessagesWithSimulator()
    {
        var parcelId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var testClientId = $"agritech-backend-it-{Guid.NewGuid():N}";

        using var backendService = new MqttClientService(
            Options.Create(new MqttOptions
            {
                Enabled = true,
                Host = BrokerHost,
                Port = BrokerPort,
                ClientId = testClientId,
                Username = BackendUser,
                Password = BackendPass,
                CleanSession = false,
                SessionExpiryIntervalSeconds = 300,
                TelemetryWildcardTopic = MqttTopics.TelemetryWildcard
            }),
            NullLogger<MqttClientService>.Instance);

        var telemetryReceived = new TaskCompletionSource<TelemetryMessageEnvelope>(TaskCreationOptions.RunContinuationsAsynchronously);
        using var handlerReg = backendService.RegisterTelemetryHandler((env, _) =>
        {
            if (env.ParcelId == parcelId)
            {
                telemetryReceived.TrySetResult(env);
            }
            return Task.CompletedTask;
        });

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        await backendService.StartAsync(cts.Token);

        try
        {
            // Wait until backend connects and subscribes to agri/telemetry/#
            var deadline = DateTime.UtcNow.AddSeconds(10);
            while (DateTime.UtcNow < deadline && (!backendService.IsConnected || !backendService.GetStatus().IsSubscribedToTelemetry))
            {
                await Task.Delay(100, cts.Token);
            }

            var status = backendService.GetStatus();
            Assert.True(status.IsConnected, $"Backend failed to connect: {status.LastError}");
            Assert.True(status.IsSubscribedToTelemetry);
            Assert.True(status.IsPersistentSession);
            Assert.Equal("agri/telemetry/#", status.SubscribedTopic);

            // Connect authenticated virtual simulator client
            using var simClient = new MqttClientFactory().CreateMqttClient();
            var valveReceived = new TaskCompletionSource<ValveActuationCommand>(TaskCreationOptions.RunContinuationsAsynchronously);

            simClient.ApplicationMessageReceivedAsync += args =>
            {
                var bytes = args.ApplicationMessage.Payload.IsEmpty
                    ? Array.Empty<byte>()
                    : args.ApplicationMessage.Payload.ToArray();
                if (MqttMessageSerializer.TryDeserialize<ValveActuationCommand>(bytes, out var cmd) && cmd is not null)
                {
                    valveReceived.TrySetResult(cmd);
                }
                return Task.CompletedTask;
            };

            var simConnect = await simClient.ConnectAsync(new MqttClientOptionsBuilder()
                .WithClientId($"agritech-sim-it-{Guid.NewGuid():N}")
                .WithTcpServer(BrokerHost, BrokerPort)
                .WithProtocolVersion(MqttProtocolVersion.V500)
                .WithCredentials(SimulatorUser, SimulatorPass)
                .Build(), cts.Token);
            Assert.Equal(MqttClientConnectResultCode.Success, simConnect.ResultCode);

            // 1. Simulator publishes telemetry on agri/telemetry/{parcelId} -> Backend receives via agri/telemetry/#
            var telemetryPayload = new SensorTelemetryMessage
            {
                NodeId = "sim-node-it-01",
                ParcelId = parcelId,
                Timestamp = DateTimeOffset.UtcNow,
                SoilMoisturePct = 23.8m,
                SoilTemperatureC = 19.4m,
                AmbientHumidityPct = 54.0m,
                BatteryVoltage = 3.92m
            };

            var pubMsg = new MqttApplicationMessageBuilder()
                .WithTopic(MqttTopics.TelemetryForParcel(parcelId))
                .WithPayload(MqttMessageSerializer.Serialize(telemetryPayload))
                .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();
            var pubResult = await simClient.PublishAsync(pubMsg, cts.Token);
            Assert.True(pubResult.IsSuccess);

            var envelope = await telemetryReceived.Task.WaitAsync(TimeSpan.FromSeconds(5), cts.Token);
            Assert.Equal(parcelId, envelope.ParcelId);
            Assert.Equal("sim-node-it-01", envelope.Payload.NodeId);
            Assert.Equal(23.8m, envelope.Payload.SoilMoisturePct);

            // 2. Simulator subscribes to agri/actuator/{parcelId}/valve -> Backend dispatches VALVE_TRIGGER_OPEN
            await simClient.SubscribeAsync(new MqttClientSubscribeOptionsBuilder()
                .WithTopicFilter(f => f
                    .WithTopic(MqttTopics.ValveActuatorForParcel(parcelId))
                    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce))
                .Build(), cts.Token);

            var valveCommand = new ValveActuationCommand
            {
                EventId = eventId,
                ParcelId = parcelId,
                Action = ValveActionConstants.TriggerOpen,
                DurationSeconds = 1800,
                TargetVolumeLiters = 14200.0m,
                Reason = "MAD_EXCEEDED_DEFICIT_RECOVERY"
            };
            await backendService.PublishValveCommandAsync(valveCommand, cts.Token);

            var receivedCmd = await valveReceived.Task.WaitAsync(TimeSpan.FromSeconds(5), cts.Token);
            Assert.Equal(eventId, receivedCmd.EventId);
            Assert.Equal(parcelId, receivedCmd.ParcelId);
            Assert.Equal(ValveActionConstants.TriggerOpen, receivedCmd.Action);
            Assert.Equal(1800, receivedCmd.DurationSeconds);

            await simClient.DisconnectAsync(cancellationToken: cts.Token);
        }
        finally
        {
            await backendService.StopAsync(CancellationToken.None);
        }
    }
}
