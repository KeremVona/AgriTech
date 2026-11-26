using System.Buffers;
using System.Text;
using AgriTech.Api.Configuration;
using AgriTech.Api.Controllers;
using AgriTech.Api.Messaging;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MQTTnet;
using MQTTnet.Diagnostics.PacketInspection;
using MQTTnet.Formatter;
using MQTTnet.Protocol;
using Xunit;

namespace AgriTech.Api.Tests;

public class MqttMessagingContractTests
{
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Standardized Topic Taxonomy (agri/telemetry/{parcelId}, agri/actuator/{parcelId}/valve)
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void MqttTopics_BuildersAndParsers_HandleCanonicalFormatsAndRejectInvalidTopics()
    {
        var parcelId = Guid.Parse("8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d");

        var telemetryTopic = MqttTopics.TelemetryForParcel(parcelId);
        var actuatorTopic = MqttTopics.ValveActuatorForParcel(parcelId);

        Assert.Equal("agri/telemetry/8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d", telemetryTopic);
        Assert.Equal("agri/actuator/8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d/valve", actuatorTopic);
        Assert.Equal("agri/telemetry/#", MqttTopics.TelemetryWildcard);

        Assert.True(MqttTopics.TryExtractParcelIdFromTelemetryTopic(telemetryTopic, out var parsedTelemetryId));
        Assert.Equal(parcelId, parsedTelemetryId);

        Assert.True(MqttTopics.TryExtractParcelIdFromActuatorTopic(actuatorTopic, out var parsedActuatorId));
        Assert.Equal(parcelId, parsedActuatorId);

        // Reject empty GUID in builders
        Assert.Throws<ArgumentException>(() => MqttTopics.TelemetryForParcel(Guid.Empty));
        Assert.Throws<ArgumentException>(() => MqttTopics.ValveActuatorForParcel(Guid.Empty));

        // Reject wildcards, wrong prefixes, empty GUIDs, or extra segments
        Assert.False(MqttTopics.TryExtractParcelIdFromTelemetryTopic("agri/telemetry/#", out _));
        Assert.False(MqttTopics.TryExtractParcelIdFromTelemetryTopic("agri/telemetry/+", out _));
        Assert.False(MqttTopics.TryExtractParcelIdFromTelemetryTopic("agri/telemetry/00000000-0000-0000-0000-000000000000", out _));
        Assert.False(MqttTopics.TryExtractParcelIdFromTelemetryTopic("agri/telemetry/not-a-guid", out _));
        Assert.False(MqttTopics.TryExtractParcelIdFromTelemetryTopic("agri/telemetry/8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d/extra", out _));
        Assert.False(MqttTopics.TryExtractParcelIdFromActuatorTopic("agri/actuator/8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d/pump", out _));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Standardized JSON Payload Contracts (Phase 3 Spec)
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void MqttMessageSerializer_RoundTripsTelemetryAndValveCommandExactPhase3Schema()
    {
        var parcelId = Guid.Parse("8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d");
        var eventId = Guid.Parse("4b6c8e1a-9f20-41da-bc33-8a9d12345678");

        var telemetry = new SensorTelemetryMessage
        {
            NodeId = "sim-node-7b2c-01",
            ParcelId = parcelId,
            Timestamp = new DateTimeOffset(2026, 9, 21, 14, 0, 0, TimeSpan.FromHours(3)),
            SoilMoisturePct = 24.3m,
            SoilTemperatureC = 19.8m,
            AmbientHumidityPct = 52.1m,
            BatteryVoltage = 3.94m
        };

        var telemetryJson = MqttMessageSerializer.Serialize(telemetry);
        Assert.Contains("\"node_id\":\"sim-node-7b2c-01\"", telemetryJson);
        Assert.Contains("\"parcel_id\":\"8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d\"", telemetryJson);
        Assert.Contains("\"soil_moisture_pct\":24.3", telemetryJson);
        Assert.Contains("\"soil_temperature_c\":19.8", telemetryJson);
        Assert.Contains("\"ambient_humidity_pct\":52.1", telemetryJson);
        Assert.Contains("\"battery_voltage\":3.94", telemetryJson);

        Assert.True(MqttMessageSerializer.TryDeserialize<SensorTelemetryMessage>(Encoding.UTF8.GetBytes(telemetryJson), out var parsedTelemetry));
        Assert.Equal(telemetry.NodeId, parsedTelemetry!.NodeId);
        Assert.Equal(telemetry.ParcelId, parsedTelemetry.ParcelId);
        Assert.Equal(telemetry.Timestamp, parsedTelemetry.Timestamp);
        Assert.Equal(telemetry.SoilMoisturePct, parsedTelemetry.SoilMoisturePct);

        var command = new ValveActuationCommand
        {
            EventId = eventId,
            ParcelId = parcelId,
            Action = ValveActionConstants.TriggerOpen,
            DurationSeconds = 1800,
            TargetVolumeLiters = 14200.0m,
            Reason = "MAD_EXCEEDED_DEFICIT_RECOVERY"
        };

        var commandJson = MqttMessageSerializer.Serialize(command);
        Assert.Contains("\"event_id\":\"4b6c8e1a-9f20-41da-bc33-8a9d12345678\"", commandJson);
        Assert.Contains("\"action\":\"VALVE_TRIGGER_OPEN\"", commandJson);
        Assert.Contains("\"duration_seconds\":1800", commandJson);
        Assert.Contains("\"target_volume_liters\":14200.0", commandJson);

        Assert.True(MqttMessageSerializer.TryDeserialize<ValveActuationCommand>(commandJson, out var parsedCommand));
        Assert.Equal(command.EventId, parsedCommand!.EventId);
        Assert.Equal(ValveActionConstants.TriggerOpen, parsedCommand.Action);
        Assert.Equal(1800, parsedCommand.DurationSeconds);

        Assert.True(ValveActionConstants.IsValid(ValveActionConstants.TriggerOpen));
        Assert.True(ValveActionConstants.IsValid(ValveActionConstants.TriggerClose));
        Assert.False(ValveActionConstants.IsValid("OPEN"));
        Assert.False(ValveActionConstants.IsValid(null));

        // Malformed / empty inputs return false cleanly
        Assert.False(MqttMessageSerializer.TryDeserialize<SensorTelemetryMessage>(ReadOnlySpan<byte>.Empty, out _));
        Assert.False(MqttMessageSerializer.TryDeserialize<SensorTelemetryMessage>("{invalid-json", out _));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Exponential Backoff + Jitter Auto-Reconnect & Persistent Session Options
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void ComputeReconnectDelay_ScalesExponentiallyWithJitterAndRespectsMaxCap()
    {
        // Without jitter (fixedJitterRatio = 0.0): 2, 4, 8, 16, 32, 60 (capped)
        Assert.Equal(TimeSpan.FromSeconds(2),  MqttClientService.ComputeReconnectDelay(1, 2, 60, fixedJitterRatio: 0.0));
        Assert.Equal(TimeSpan.FromSeconds(4),  MqttClientService.ComputeReconnectDelay(2, 2, 60, fixedJitterRatio: 0.0));
        Assert.Equal(TimeSpan.FromSeconds(8),  MqttClientService.ComputeReconnectDelay(3, 2, 60, fixedJitterRatio: 0.0));
        Assert.Equal(TimeSpan.FromSeconds(16), MqttClientService.ComputeReconnectDelay(4, 2, 60, fixedJitterRatio: 0.0));
        Assert.Equal(TimeSpan.FromSeconds(32), MqttClientService.ComputeReconnectDelay(5, 2, 60, fixedJitterRatio: 0.0));
        Assert.Equal(TimeSpan.FromSeconds(60), MqttClientService.ComputeReconnectDelay(6, 2, 60, fixedJitterRatio: 0.0));

        // With max jitter (fixedJitterRatio = 1.0): +25%, still capped at maxDelaySeconds
        Assert.Equal(TimeSpan.FromSeconds(2.5), MqttClientService.ComputeReconnectDelay(1, 2, 60, fixedJitterRatio: 1.0));
        Assert.Equal(TimeSpan.FromSeconds(60),  MqttClientService.ComputeReconnectDelay(6, 2, 60, fixedJitterRatio: 1.0));
    }

    [Fact]
    public void BuildClientOptions_ConfiguresPersistentAndCleanMqttV5SessionCorrectly()
    {
        using var persistentService = new MqttClientService(
            Options.Create(new MqttOptions
            {
                Host = "mosquitto",
                Port = 1883,
                ClientId = "agritech-backend-api",
                Username = "agritech_backend",
                Password = "secret",
                CleanSession = false,
                SessionExpiryIntervalSeconds = 86_400
            }),
            NullLogger<MqttClientService>.Instance);

        var persistentOpts = persistentService.BuildClientOptions();
        Assert.Equal("agritech-backend-api", persistentOpts.ClientId);
        Assert.Equal(MqttProtocolVersion.V500, persistentOpts.ProtocolVersion);
        Assert.False(persistentOpts.CleanSession);
        Assert.Equal(86_400u, persistentOpts.SessionExpiryInterval);
        Assert.NotNull(persistentOpts.Credentials);

        // When CleanSession = true, SessionExpiryInterval must be 0 per MQTT 5.0 spec
        using var cleanService = new MqttClientService(
            Options.Create(new MqttOptions
            {
                CleanSession = true,
                SessionExpiryIntervalSeconds = 86_400
            }),
            NullLogger<MqttClientService>.Instance);

        var cleanOpts = cleanService.BuildClientOptions();
        Assert.True(cleanOpts.CleanSession);
        Assert.Equal(0u, cleanOpts.SessionExpiryInterval);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Message Dispatch, Boundary Validation, Spoof Filtering & Handler Isolation
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleMessageReceivedAsync_DispatchesValidTelemetryAndRejectsInvalidPayloads()
    {
        using var service = new MqttClientService(
            Options.Create(new MqttOptions { Enabled = false }),
            NullLogger<MqttClientService>.Instance);

        var parcelId = Guid.NewGuid();
        var received = new List<TelemetryMessageEnvelope>();

        // Register one failing handler and one healthy handler to verify error isolation
        using var failingReg = service.RegisterTelemetryHandler((_, _) => throw new InvalidOperationException("Simulated handler crash"));
        using var healthyReg = service.RegisterTelemetryHandler((env, _) =>
        {
            received.Add(env);
            return Task.CompletedTask;
        });

        var validJson = MqttMessageSerializer.Serialize(new SensorTelemetryMessage
        {
            NodeId = "sim-node-01",
            ParcelId = parcelId,
            Timestamp = DateTimeOffset.UtcNow,
            SoilMoisturePct = 21.5m,
            SoilTemperatureC = 18.2m,
            BatteryVoltage = 3.91m
        });

        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), validJson));
        Assert.Single(received);
        Assert.Equal(parcelId, received[0].ParcelId);
        Assert.Equal(1, service.GetStatus().MessagesReceivedCount);

        // Spoofed parcel_id mismatch between topic and payload must be dropped
        var spoofJson = MqttMessageSerializer.Serialize(new SensorTelemetryMessage
        {
            NodeId = "sim-node-01",
            ParcelId = Guid.NewGuid(),
            Timestamp = DateTimeOffset.UtcNow,
            SoilMoisturePct = 10.0m,
            SoilTemperatureC = 18.0m,
            BatteryVoltage = 3.80m
        });
        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), spoofJson));

        // Empty JSON object / missing parcel_id (Guid.Empty) must be dropped
        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), "{}"));

        // Missing node_id must be dropped
        var missingNodeJson = MqttMessageSerializer.Serialize(new SensorTelemetryMessage
        {
            NodeId = "   ",
            ParcelId = parcelId,
            Timestamp = DateTimeOffset.UtcNow,
            SoilMoisturePct = 22.0m
        });
        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), missingNodeJson));

        // Missing / default timestamp must be dropped
        var missingTsJson = MqttMessageSerializer.Serialize(new SensorTelemetryMessage
        {
            NodeId = "sim-node-01",
            ParcelId = parcelId,
            Timestamp = default,
            SoilMoisturePct = 22.0m
        });
        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), missingTsJson));

        // Malformed JSON and non-parcel topic must be dropped
        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), "{bad-json"));
        await service.HandleMessageReceivedAsync(BuildReceivedArgs("agri/health/check", validJson));

        Assert.Single(received);
        Assert.Equal(1, service.GetStatus().MessagesReceivedCount);

        // After disposing healthy registration, handler no longer fires
        healthyReg.Dispose();
        await service.HandleMessageReceivedAsync(BuildReceivedArgs(MqttTopics.TelemetryForParcel(parcelId), validJson));
        Assert.Single(received);
        Assert.Equal(2, service.GetStatus().MessagesReceivedCount);
    }

    [Fact]
    public async Task PublishValveCommandAsync_ValidatesContractAndConnectionGuard()
    {
        using var service = new MqttClientService(
            Options.Create(new MqttOptions { Enabled = false }),
            NullLogger<MqttClientService>.Instance);

        // Empty ParcelId
        await Assert.ThrowsAsync<ArgumentException>(() => service.PublishValveCommandAsync(new ValveActuationCommand
        {
            EventId = Guid.NewGuid(),
            ParcelId = Guid.Empty,
            Action = ValveActionConstants.TriggerOpen
        }));

        // Invalid Action constant
        await Assert.ThrowsAsync<ArgumentException>(() => service.PublishValveCommandAsync(new ValveActuationCommand
        {
            EventId = Guid.NewGuid(),
            ParcelId = Guid.NewGuid(),
            Action = "OPEN_NOW",
            DurationSeconds = 60,
            TargetVolumeLiters = 100m
        }));

        // Negative DurationSeconds
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.PublishValveCommandAsync(new ValveActuationCommand
        {
            EventId = Guid.NewGuid(),
            ParcelId = Guid.NewGuid(),
            Action = ValveActionConstants.TriggerOpen,
            DurationSeconds = -10,
            TargetVolumeLiters = 100m
        }));

        // Negative TargetVolumeLiters
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.PublishValveCommandAsync(new ValveActuationCommand
        {
            EventId = Guid.NewGuid(),
            ParcelId = Guid.NewGuid(),
            Action = ValveActionConstants.TriggerClose,
            DurationSeconds = 0,
            TargetVolumeLiters = -1m
        }));

        // Valid command while disconnected throws InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.PublishValveCommandAsync(new ValveActuationCommand
        {
            EventId = Guid.NewGuid(),
            ParcelId = Guid.NewGuid(),
            Action = ValveActionConstants.TriggerOpen,
            DurationSeconds = 600,
            TargetVolumeLiters = 5000m,
            Reason = "TEST"
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Auto-Reconnect Loop, Subscribe Rejection Recovery & Safe Shutdown/Dispose
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_WhenSubscribeRejectedOnce_RetriesAndRecoversWithoutStalling()
    {
        var fakeClient = new FakeMqttClient(rejectFirstSubscribe: true);
        using var service = new MqttClientService(
            Options.Create(new MqttOptions
            {
                Enabled = true,
                ReconnectInitialDelaySeconds = 1,
                ReconnectMaxDelaySeconds = 1
            }),
            NullLogger<MqttClientService>.Instance,
            fakeClient);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await service.StartAsync(cts.Token);

        try
        {
            // Wait for recovery on second subscribe attempt (must NOT stall after first rejection)
            var deadline = DateTime.UtcNow.AddSeconds(6);
            while (DateTime.UtcNow < deadline && !service.GetStatus().IsSubscribedToTelemetry)
            {
                await Task.Delay(100, cts.Token);
            }

            var status = service.GetStatus();
            Assert.True(status.IsConnected);
            Assert.True(status.IsSubscribedToTelemetry);
            Assert.Null(status.LastError);
            Assert.Equal(2, fakeClient.SubscribeCalls);
            Assert.Equal(0, status.ReconnectAttempts);
        }
        finally
        {
            await service.StopAsync(CancellationToken.None);
        }

        // Clean shutdown must NOT pollute LastError or throw on double Dispose
        Assert.Null(service.GetStatus().LastError);
        Assert.False(service.GetStatus().IsConnected);
        Assert.False(service.GetStatus().IsSubscribedToTelemetry);
        service.Dispose();
        service.Dispose();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Controller Contract & Non-Development Redaction
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void MqttController_ReturnsFullStatusInDevelopmentAndRedactsInProduction()
    {
        using var service = new MqttClientService(
            Options.Create(new MqttOptions
            {
                Enabled = false,
                Host = "mosquitto.internal",
                Port = 1883,
                ClientId = "test-client"
            }),
            NullLogger<MqttClientService>.Instance);

        var devController = new MqttController(service, new FakeHostEnvironment(Environments.Development));
        var devStatus = Assert.IsType<MqttConnectionStatusDto>(Assert.IsType<OkObjectResult>(devController.GetStatus().Result).Value);
        Assert.Equal("mosquitto.internal", devStatus.Host);
        Assert.Equal(1883, devStatus.Port);
        Assert.Equal("test-client", devStatus.ClientId);
        Assert.Equal("agri/telemetry/#", devStatus.SubscribedTopic);
        Assert.True(devStatus.IsPersistentSession);

        var prodController = new MqttController(service, new FakeHostEnvironment(Environments.Production));
        var prodStatus = Assert.IsType<MqttConnectionStatusDto>(Assert.IsType<OkObjectResult>(prodController.GetStatus().Result).Value);
        Assert.Equal("[redacted]", prodStatus.Host);
        Assert.Equal(0, prodStatus.Port);

        var topics = Assert.IsType<MqttTopicsContractDto>(Assert.IsType<OkObjectResult>(devController.GetTopics().Result).Value);
        Assert.Equal("agri/telemetry/{parcelId}", topics.TelemetryTemplate);
        Assert.Equal("agri/telemetry/#", topics.TelemetryWildcard);
        Assert.Equal("agri/actuator/{parcelId}/valve", topics.ActuatorValveTemplate);
        Assert.Contains(ValveActionConstants.TriggerOpen, topics.ValveActions);
        Assert.Contains(ValveActionConstants.TriggerClose, topics.ValveActions);
    }

    private static MqttApplicationMessageReceivedEventArgs BuildReceivedArgs(string topic, string payload)
    {
        var msg = new MqttApplicationMessage
        {
            Topic = topic,
            Payload = new ReadOnlySequence<byte>(Encoding.UTF8.GetBytes(payload))
        };

        return new MqttApplicationMessageReceivedEventArgs("test-client", msg, new MQTTnet.Packets.MqttPublishPacket(), null);
    }

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public FakeHostEnvironment(string environmentName) => EnvironmentName = environmentName;
        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; } = "AgriTech.Api.Tests";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    /// <summary>
    /// Minimal in-memory IMqttClient fake for deterministic unit testing of reconnect, subscribe recovery, and shutdown.
    /// </summary>
    private sealed class FakeMqttClient : IMqttClient
    {
        private readonly bool _rejectFirstSubscribe;
        private int _subscribeCalls;
        private volatile bool _isConnected;

        public FakeMqttClient(bool rejectFirstSubscribe)
        {
            _rejectFirstSubscribe = rejectFirstSubscribe;
        }

        public int SubscribeCalls => Volatile.Read(ref _subscribeCalls);
        public bool IsConnected => _isConnected;
        public MqttClientOptions? Options { get; private set; }

        public event Func<MqttApplicationMessageReceivedEventArgs, Task>? ApplicationMessageReceivedAsync;
        public event Func<MqttClientConnectedEventArgs, Task>? ConnectedAsync;
        public event Func<MqttClientConnectingEventArgs, Task>? ConnectingAsync;
        public event Func<MqttClientDisconnectedEventArgs, Task>? DisconnectedAsync;
        public event Func<InspectMqttPacketEventArgs, Task>? InspectPacketAsync;

        public async Task<MqttClientConnectResult> ConnectAsync(MqttClientOptions options, CancellationToken cancellationToken = default)
        {
            Options = options;
            _isConnected = true;
            var result = new MqttClientConnectResult();
            if (ConnectedAsync is not null)
            {
                await ConnectedAsync.Invoke(new MqttClientConnectedEventArgs(result));
            }
            return result;
        }

        public async Task DisconnectAsync(MqttClientDisconnectOptions options, CancellationToken cancellationToken = default)
        {
            var wasConnected = _isConnected;
            _isConnected = false;
            if (DisconnectedAsync is not null)
            {
                await DisconnectedAsync.Invoke(new MqttClientDisconnectedEventArgs(
                    wasConnected,
                    null,
                    MqttClientDisconnectReason.NormalDisconnection,
                    "Normal",
                    null,
                    null));
            }
        }

        public Task<MqttClientSubscribeResult> SubscribeAsync(MqttClientSubscribeOptions options, CancellationToken cancellationToken = default)
        {
            var attempt = Interlocked.Increment(ref _subscribeCalls);
            var code = (_rejectFirstSubscribe && attempt == 1)
                ? MqttClientSubscribeResultCode.NotAuthorized
                : MqttClientSubscribeResultCode.GrantedQoS1;

            var items = options.TopicFilters
                .Select(f => new MqttClientSubscribeResultItem(f, code))
                .ToList();

            return Task.FromResult(new MqttClientSubscribeResult(1, items, string.Empty, new List<MQTTnet.Packets.MqttUserProperty>()));
        }

        public Task<MqttClientUnsubscribeResult> UnsubscribeAsync(MqttClientUnsubscribeOptions options, CancellationToken cancellationToken = default)
            => Task.FromResult(new MqttClientUnsubscribeResult(1, new List<MqttClientUnsubscribeResultItem>(), string.Empty, new List<MQTTnet.Packets.MqttUserProperty>()));

        public Task<MqttClientPublishResult> PublishAsync(MqttApplicationMessage applicationMessage, CancellationToken cancellationToken = default)
            => Task.FromResult(new MqttClientPublishResult(1, MqttClientPublishReasonCode.Success, string.Empty, new List<MQTTnet.Packets.MqttUserProperty>()));

        public Task PingAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task SendEnhancedAuthenticationExchangeDataAsync(MqttEnhancedAuthenticationExchangeData data, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public void Dispose()
        {
            // Keep unused event references clean
            _ = ApplicationMessageReceivedAsync;
            _ = ConnectingAsync;
            _ = InspectPacketAsync;
        }
    }
}
