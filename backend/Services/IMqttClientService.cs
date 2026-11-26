using AgriTech.Api.Messaging;
using MQTTnet.Protocol;

namespace AgriTech.Api.Services;

/// <summary>
/// Diagnostic status snapshot for the backend's Eclipse Mosquitto MQTT connection (BACK-304).
/// </summary>
public sealed class MqttConnectionStatusDto
{
    public bool Enabled { get; init; }
    public bool IsConnected { get; init; }
    public string Host { get; init; } = string.Empty;
    public int Port { get; init; }
    public string ClientId { get; init; } = string.Empty;
    public string SubscribedTopic { get; init; } = string.Empty;
    public bool IsPersistentSession { get; init; }
    public bool IsSubscribedToTelemetry { get; init; }
    public DateTime? LastConnectedAtUtc { get; init; }
    public DateTime? LastDisconnectedAtUtc { get; init; }
    public int ReconnectAttempts { get; init; }
    public long MessagesReceivedCount { get; init; }
    public long MessagesPublishedCount { get; init; }
    public string? LastError { get; init; }
}

/// <summary>
/// ASP.NET Core MQTT client integration contract powered by MQTTnet (BACK-304).
/// Maintains a persistent wildcard subscription to agri/telemetry/# with automatic reconnection
/// and exposes typed publish operations for valve actuation commands.
/// </summary>
public interface IMqttClientService
{
    /// <summary>
    /// True when actively connected to the Eclipse Mosquitto broker.
    /// </summary>
    bool IsConnected { get; }

    /// <summary>
    /// Returns the live connection, subscription, and throughput status snapshot.
    /// </summary>
    MqttConnectionStatusDto GetStatus();

    /// <summary>
    /// Publishes a standardized valve actuation command with QoS 1 to agri/actuator/{parcelId}/valve.
    /// Note: Under Mosquitto least-privilege ACLs, agritech_backend is read-only on agri/telemetry/#
    /// and readwrite on agri/actuator/+/valve; sensor simulators publish telemetry via agritech_simulator.
    /// </summary>
    Task PublishValveCommandAsync(ValveActuationCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Publishes an arbitrary UTF-8 payload to a specified MQTT topic.
    /// </summary>
    Task PublishRawAsync(
        string topic,
        string payload,
        MqttQualityOfServiceLevel qos = MqttQualityOfServiceLevel.AtLeastOnce,
        bool retain = false,
        string contentType = "application/json",
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Registers an asynchronous handler invoked whenever a valid telemetry packet arrives on agri/telemetry/#.
    /// Dispose the returned handle to unregister.
    /// </summary>
    IDisposable RegisterTelemetryHandler(Func<TelemetryMessageEnvelope, CancellationToken, Task> handler);
}
