using System.Buffers;
using System.Collections.Concurrent;
using AgriTech.Api.Configuration;
using AgriTech.Api.Messaging;
using Microsoft.Extensions.Options;
using MQTTnet;
using MQTTnet.Formatter;
using MQTTnet.Protocol;

namespace AgriTech.Api.Services;

/// <summary>
/// Background hosted MQTT client using MQTTnet 5 with:
///   - Authenticated connection to Eclipse Mosquitto on port 1883 (least-privilege agritech_backend identity)
///   - Persistent MQTT 5.0 session (CleanSession = false) and wildcard subscription to agri/telemetry/#
///   - Exponential backoff + jitter auto-reconnect loop upon broker disconnect, subscription failure, or network drop
///   - Typed publish pipeline for agri/actuator/{parcelId}/valve and observer dispatch for TODO-306
/// </summary>
public class MqttClientService : BackgroundService, IMqttClientService
{
    private readonly MqttOptions _options;
    private readonly ILogger<MqttClientService> _logger;
    private readonly IMqttClient _mqttClient;
    private readonly SemaphoreSlim _connectLock = new(1, 1);
    private readonly SemaphoreSlim _reconnectSignal = new(0, 1);
    private readonly ConcurrentDictionary<Guid, Func<TelemetryMessageEnvelope, CancellationToken, Task>> _telemetryHandlers = new();

    private volatile bool _isSubscribedToTelemetry;
    private volatile string? _lastError;
    private long _lastConnectedAtUtcTicks;
    private long _lastDisconnectedAtUtcTicks;
    private int _reconnectAttempts;
    private long _messagesReceivedCount;
    private long _messagesPublishedCount;
    private int _isShuttingDown;
    private int _disposed;
    private CancellationToken _stoppingToken = CancellationToken.None;

    public MqttClientService(
        IOptions<MqttOptions> options,
        ILogger<MqttClientService> logger)
        : this(options, logger, new MqttClientFactory().CreateMqttClient())
    {
    }

    /// <summary>
    /// Internal constructor allowing unit tests to inject a custom or mocked IMqttClient.
    /// </summary>
    internal MqttClientService(
        IOptions<MqttOptions> options,
        ILogger<MqttClientService> logger,
        IMqttClient mqttClient)
    {
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _mqttClient = mqttClient ?? throw new ArgumentNullException(nameof(mqttClient));

        _mqttClient.ConnectedAsync += HandleConnectedAsync;
        _mqttClient.DisconnectedAsync += HandleDisconnectedAsync;
        _mqttClient.ApplicationMessageReceivedAsync += HandleMessageReceivedAsync;
    }

    /// <inheritdoc />
    public bool IsConnected => _mqttClient.IsConnected;

    /// <inheritdoc />
    public MqttConnectionStatusDto GetStatus()
    {
        var isConnected = _mqttClient.IsConnected;
        var lastConnectedTicks = Interlocked.Read(ref _lastConnectedAtUtcTicks);
        var lastDisconnectedTicks = Interlocked.Read(ref _lastDisconnectedAtUtcTicks);

        return new MqttConnectionStatusDto
        {
            Enabled = _options.Enabled,
            IsConnected = isConnected,
            Host = _options.Host,
            Port = _options.Port,
            ClientId = _options.ClientId,
            SubscribedTopic = _options.TelemetryWildcardTopic,
            IsPersistentSession = !_options.CleanSession,
            IsSubscribedToTelemetry = isConnected && _isSubscribedToTelemetry,
            LastConnectedAtUtc = lastConnectedTicks > 0 ? new DateTime(lastConnectedTicks, DateTimeKind.Utc) : null,
            LastDisconnectedAtUtc = lastDisconnectedTicks > 0 ? new DateTime(lastDisconnectedTicks, DateTimeKind.Utc) : null,
            ReconnectAttempts = Volatile.Read(ref _reconnectAttempts),
            MessagesReceivedCount = Interlocked.Read(ref _messagesReceivedCount),
            MessagesPublishedCount = Interlocked.Read(ref _messagesPublishedCount),
            LastError = _lastError
        };
    }

    /// <inheritdoc />
    public Task PublishValveCommandAsync(ValveActuationCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (command.ParcelId == Guid.Empty)
        {
            throw new ArgumentException("ValveActuationCommand.ParcelId cannot be empty.", nameof(command));
        }

        if (command.EventId == Guid.Empty)
        {
            throw new ArgumentException("ValveActuationCommand.EventId cannot be empty.", nameof(command));
        }

        if (!ValveActionConstants.IsValid(command.Action))
        {
            throw new ArgumentException(
                $"ValveActuationCommand.Action must be '{ValveActionConstants.TriggerOpen}' or '{ValveActionConstants.TriggerClose}'.",
                nameof(command));
        }

        if (command.DurationSeconds < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(command), "ValveActuationCommand.DurationSeconds cannot be negative.");
        }

        if (command.TargetVolumeLiters < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(command), "ValveActuationCommand.TargetVolumeLiters cannot be negative.");
        }

        var topic = MqttTopics.ValveActuatorForParcel(command.ParcelId);
        var payload = MqttMessageSerializer.Serialize(command);
        return PublishRawAsync(
            topic,
            payload,
            MqttQualityOfServiceLevel.AtLeastOnce,
            retain: false,
            contentType: "application/json",
            cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task PublishRawAsync(
        string topic,
        string payload,
        MqttQualityOfServiceLevel qos = MqttQualityOfServiceLevel.AtLeastOnce,
        bool retain = false,
        string contentType = "application/json",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(topic))
        {
            throw new ArgumentException("MQTT topic cannot be empty.", nameof(topic));
        }

        if (!_mqttClient.IsConnected)
        {
            throw new InvalidOperationException(
                $"Cannot publish to MQTT topic '{topic}': client '{_options.ClientId}' is not currently connected to {_options.Host}:{_options.Port}.");
        }

        var builder = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(payload ?? string.Empty)
            .WithQualityOfServiceLevel(qos)
            .WithRetainFlag(retain);

        if (!string.IsNullOrWhiteSpace(contentType))
        {
            builder.WithContentType(contentType);
        }

        var message = builder.Build();

        var result = await _mqttClient.PublishAsync(message, cancellationToken);
        if (!result.IsSuccess)
        {
            throw new InvalidOperationException(
                $"MQTT publish to topic '{topic}' failed with reason code {result.ReasonCode}: {result.ReasonString}");
        }

        Interlocked.Increment(ref _messagesPublishedCount);
        _logger.LogDebug("Published MQTT message to '{Topic}' (QoS={Qos}, Retain={Retain}).", topic, qos, retain);
    }

    /// <inheritdoc />
    public IDisposable RegisterTelemetryHandler(Func<TelemetryMessageEnvelope, CancellationToken, Task> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        var registrationId = Guid.NewGuid();
        _telemetryHandlers[registrationId] = handler;
        return new HandlerRegistration(_telemetryHandlers, registrationId);
    }

    /// <summary>
    /// Computes bounded exponential backoff delay with optional randomized jitter for auto-reconnect attempts.
    /// </summary>
    internal static TimeSpan ComputeReconnectDelay(
        int attemptNumber,
        int initialDelaySeconds,
        int maxDelaySeconds,
        double? fixedJitterRatio = null)
    {
        int clampedInitial = Math.Max(1, initialDelaySeconds);
        int clampedMax = Math.Max(clampedInitial, maxDelaySeconds);
        int exponent = Math.Clamp(attemptNumber - 1, 0, 10);

        double baseSeconds = Math.Min(clampedMax, clampedInitial * Math.Pow(2, exponent));
        double jitterRatio = fixedJitterRatio ?? Random.Shared.NextDouble();
        double jitteredSeconds = Math.Min(clampedMax, baseSeconds + (baseSeconds * 0.25 * Math.Clamp(jitterRatio, 0.0, 1.0)));

        return TimeSpan.FromSeconds(jitteredSeconds);
    }

    internal MqttClientOptions BuildClientOptions()
    {
        uint sessionExpirySeconds = _options.CleanSession ? 0u : _options.SessionExpiryIntervalSeconds;

        var builder = new MqttClientOptionsBuilder()
            .WithClientId(_options.ClientId)
            .WithTcpServer(_options.Host, _options.Port)
            .WithProtocolVersion(MqttProtocolVersion.V500)
            .WithCleanSession(_options.CleanSession)
            .WithSessionExpiryInterval(sessionExpirySeconds)
            .WithKeepAlivePeriod(TimeSpan.FromSeconds(Math.Max(5, _options.KeepAliveSeconds)))
            .WithTimeout(TimeSpan.FromSeconds(Math.Max(2, _options.ConnectTimeoutSeconds)));

        if (!string.IsNullOrEmpty(_options.Username))
        {
            builder.WithCredentials(_options.Username, _options.Password);
        }

        if (_options.UseTls)
        {
            builder.WithTlsOptions(tls => tls.UseTls(true));
        }

        return builder.Build();
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        Interlocked.Exchange(ref _isShuttingDown, 1);
        return base.StopAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _stoppingToken = stoppingToken;

        if (!_options.Enabled)
        {
            _logger.LogInformation("MqttClientService is disabled via configuration (Mqtt:Enabled = false).");
            return;
        }

        if (!string.IsNullOrEmpty(_options.Username) && string.IsNullOrEmpty(_options.Password))
        {
            _logger.LogWarning(
                "Mqtt:Password is empty for configured user '{Username}'. Set Mqtt__Password via environment variables or User Secrets.",
                _options.Username);
        }

        _logger.LogInformation(
            "Starting MqttClientService for broker {Host}:{Port} (ClientId='{ClientId}', CleanSession={CleanSession}, Wildcard='{Topic}').",
            _options.Host, _options.Port, _options.ClientId, _options.CleanSession, _options.TelemetryWildcardTopic);

        int consecutiveFailures = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            if (!_mqttClient.IsConnected || !_isSubscribedToTelemetry)
            {
                bool ready = await TryConnectAndSubscribeAsync(stoppingToken);
                if (ready)
                {
                    consecutiveFailures = 0;
                    Interlocked.Exchange(ref _reconnectAttempts, 0);
                }
                else
                {
                    consecutiveFailures++;
                    Interlocked.Increment(ref _reconnectAttempts);
                    var delay = ComputeReconnectDelay(
                        consecutiveFailures,
                        _options.ReconnectInitialDelaySeconds,
                        _options.ReconnectMaxDelaySeconds);

                    _logger.LogWarning(
                        "MQTT broker {Host}:{Port} not ready (attempt #{Attempt}). Retrying in {DelaySeconds:F1}s...",
                        _options.Host, _options.Port, consecutiveFailures, delay.TotalSeconds);

                    try
                    {
                        await Task.Delay(delay, stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }

                    continue;
                }
            }

            // Wait until either a disconnect signal arrives or host shutdown is requested
            try
            {
                await _reconnectSignal.WaitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }
        }

        Interlocked.Exchange(ref _isShuttingDown, 1);
        await DisconnectGracefullyAsync();
    }

    private async Task<bool> TryConnectAndSubscribeAsync(CancellationToken cancellationToken)
    {
        await _connectLock.WaitAsync(cancellationToken);
        try
        {
            if (_mqttClient.IsConnected && _isSubscribedToTelemetry)
            {
                return true;
            }

            bool sessionPresent = false;
            if (!_mqttClient.IsConnected)
            {
                var clientOptions = BuildClientOptions();
                var connectResult = await _mqttClient.ConnectAsync(clientOptions, cancellationToken);
                if (connectResult.ResultCode != MqttClientConnectResultCode.Success)
                {
                    _isSubscribedToTelemetry = false;
                    _lastError = $"CONNECTION_REJECTED:{connectResult.ResultCode}";
                    _logger.LogError(
                        "MQTT connection rejected by {Host}:{Port}: {ResultCode} ({Reason}).",
                        _options.Host, _options.Port, connectResult.ResultCode, connectResult.ReasonString);
                    return false;
                }

                sessionPresent = connectResult.IsSessionPresent;
            }

            // Establish persistent QoS 1 wildcard subscription to agri/telemetry/#
            var subscribeOptions = new MqttClientSubscribeOptionsBuilder()
                .WithTopicFilter(f => f
                    .WithTopic(_options.TelemetryWildcardTopic)
                    .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce))
                .Build();

            var subResult = await _mqttClient.SubscribeAsync(subscribeOptions, cancellationToken);
            var granted = subResult.Items.FirstOrDefault()?.ResultCode;
            bool subscribed = granted is MqttClientSubscribeResultCode.GrantedQoS0
                or MqttClientSubscribeResultCode.GrantedQoS1
                or MqttClientSubscribeResultCode.GrantedQoS2;

            if (!subscribed)
            {
                _isSubscribedToTelemetry = false;
                _lastError = $"SUBSCRIPTION_REJECTED:{granted?.ToString() ?? "Unknown"}";
                _logger.LogError(
                    "MQTT subscription to '{Topic}' was rejected by broker (ResultCode={Code}).",
                    _options.TelemetryWildcardTopic, granted);
                return false;
            }

            // Guard against a concurrent disconnect occurring right as SubscribeAsync returned
            if (!_mqttClient.IsConnected)
            {
                _isSubscribedToTelemetry = false;
                return false;
            }

            _isSubscribedToTelemetry = true;
            _lastError = null;
            Interlocked.Exchange(ref _lastConnectedAtUtcTicks, DateTime.UtcNow.Ticks);

            _logger.LogInformation(
                "Connected to MQTT broker {Host}:{Port} (SessionPresent={SessionPresent}) and subscribed persistently to '{Topic}' (Granted={Granted}).",
                _options.Host, _options.Port, sessionPresent, _options.TelemetryWildcardTopic, granted);

            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return false;
        }
        catch (Exception ex)
        {
            _lastError = "CONNECTION_FAILED";
            _isSubscribedToTelemetry = false;
            _logger.LogWarning(ex, "MQTT connect/subscribe attempt to {Host}:{Port} failed.", _options.Host, _options.Port);
            return false;
        }
        finally
        {
            _connectLock.Release();
        }
    }

    private Task HandleConnectedAsync(MqttClientConnectedEventArgs args)
    {
        Interlocked.Exchange(ref _lastConnectedAtUtcTicks, DateTime.UtcNow.Ticks);
        return Task.CompletedTask;
    }

    private Task HandleDisconnectedAsync(MqttClientDisconnectedEventArgs args)
    {
        _isSubscribedToTelemetry = false;
        Interlocked.Exchange(ref _lastDisconnectedAtUtcTicks, DateTime.UtcNow.Ticks);

        if (Volatile.Read(ref _isShuttingDown) != 0 || Volatile.Read(ref _disposed) != 0)
        {
            return Task.CompletedTask;
        }

        if (!args.ClientWasConnected)
        {
            return Task.CompletedTask;
        }

        _lastError = $"DISCONNECTED:{args.Reason}";
        _logger.LogWarning(
            args.Exception,
            "Disconnected from MQTT broker {Host}:{Port} (Reason={Reason}). Triggering auto-reconnect loop.",
            _options.Host, _options.Port, args.Reason);

        // Signal the supervision loop to wake up and reconnect immediately (non-blocking)
        try
        {
            if (_reconnectSignal.CurrentCount == 0)
            {
                _reconnectSignal.Release();
            }
        }
        catch (SemaphoreFullException)
        {
        }
        catch (ObjectDisposedException)
        {
        }

        return Task.CompletedTask;
    }

    internal async Task HandleMessageReceivedAsync(MqttApplicationMessageReceivedEventArgs args)
    {
        var topic = args.ApplicationMessage.Topic;
        var payloadSeq = args.ApplicationMessage.Payload;

        if (!MqttTopics.TryExtractParcelIdFromTelemetryTopic(topic, out var topicParcelId))
        {
            _logger.LogDebug("Ignoring MQTT message on non-parcel telemetry topic '{Topic}'.", topic);
            return;
        }

        SensorTelemetryMessage? message;
        bool parsed;
        if (payloadSeq.IsEmpty)
        {
            parsed = false;
            message = null;
        }
        else if (payloadSeq.IsSingleSegment)
        {
            parsed = MqttMessageSerializer.TryDeserialize(payloadSeq.FirstSpan, out message);
        }
        else
        {
            parsed = MqttMessageSerializer.TryDeserialize(payloadSeq.ToArray(), out message);
        }

        if (!parsed || message is null)
        {
            _logger.LogWarning(
                "Malformed JSON telemetry payload received on topic '{Topic}' ({ByteCount} bytes).",
                topic, payloadSeq.Length);
            return;
        }

        // Strict boundary validation: parcel_id must be present and match the topic parcelId (rejects Guid.Empty & spoofing)
        if (message.ParcelId != topicParcelId)
        {
            _logger.LogWarning(
                "Rejecting telemetry packet on topic '{Topic}': payload parcel_id ({PayloadParcelId}) does not match topic parcelId ({TopicParcelId}).",
                topic, message.ParcelId, topicParcelId);
            return;
        }

        if (string.IsNullOrWhiteSpace(message.NodeId))
        {
            _logger.LogWarning(
                "Rejecting telemetry packet on topic '{Topic}': missing required field 'node_id'.",
                topic);
            return;
        }

        if (message.Timestamp == default)
        {
            _logger.LogWarning(
                "Rejecting telemetry packet on topic '{Topic}': missing or default 'timestamp'.",
                topic);
            return;
        }

        Interlocked.Increment(ref _messagesReceivedCount);

        var envelope = new TelemetryMessageEnvelope(
            Topic: topic,
            ParcelId: topicParcelId,
            Payload: message,
            ReceivedAtUtc: DateTime.UtcNow);

        foreach (var kvp in _telemetryHandlers)
        {
            try
            {
                await kvp.Value(envelope, _stoppingToken);
            }
            catch (OperationCanceledException) when (_stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Telemetry handler {HandlerId} failed while processing packet for parcel {ParcelId}.", kvp.Key, topicParcelId);
            }
        }
    }

    private async Task DisconnectGracefullyAsync()
    {
        if (!_mqttClient.IsConnected)
        {
            return;
        }

        try
        {
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var disconnectOptions = new MqttClientDisconnectOptionsBuilder()
                .WithReason(MqttClientDisconnectOptionsReason.NormalDisconnection)
                .Build();
            await _mqttClient.DisconnectAsync(disconnectOptions, timeoutCts.Token);
            _logger.LogInformation("Disconnected cleanly from MQTT broker {Host}:{Port}.", _options.Host, _options.Port);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error during graceful MQTT disconnect.");
        }
    }

    public override void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        Interlocked.Exchange(ref _isShuttingDown, 1);

        _mqttClient.ConnectedAsync -= HandleConnectedAsync;
        _mqttClient.DisconnectedAsync -= HandleDisconnectedAsync;
        _mqttClient.ApplicationMessageReceivedAsync -= HandleMessageReceivedAsync;
        _mqttClient.Dispose();
        _connectLock.Dispose();
        _reconnectSignal.Dispose();
        base.Dispose();
    }

    private sealed class HandlerRegistration : IDisposable
    {
        private readonly ConcurrentDictionary<Guid, Func<TelemetryMessageEnvelope, CancellationToken, Task>> _handlers;
        private readonly Guid _id;

        public HandlerRegistration(
            ConcurrentDictionary<Guid, Func<TelemetryMessageEnvelope, CancellationToken, Task>> handlers,
            Guid id)
        {
            _handlers = handlers;
            _id = id;
        }

        public void Dispose() => _handlers.TryRemove(_id, out _);
    }
}
