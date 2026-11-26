using AgriTech.Api.Messaging;

namespace AgriTech.Api.Configuration;

/// <summary>
/// Configuration options for connecting the ASP.NET Core backend to the Eclipse Mosquitto MQTT broker (BACK-304).
/// </summary>
public class MqttOptions
{
    public const string SectionName = "Mqtt";

    /// <summary>
    /// Enables or disables the background MQTT client connection. Default is true.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Broker hostname or IP address ("mosquitto" inside Docker agritech_internal, "127.0.0.1" on local dev host).
    /// </summary>
    public string Host { get; set; } = "127.0.0.1";

    /// <summary>
    /// Broker TCP port. Default is 1883.
    /// </summary>
    public int Port { get; set; } = 1883;

    /// <summary>
    /// Fixed client identifier required by MQTT brokers to preserve persistent sessions across reconnects.
    /// </summary>
    public string ClientId { get; set; } = "agritech-backend-api";

    /// <summary>
    /// Authenticated Mosquitto username configured in acl.conf (default: agritech_backend).
    /// </summary>
    public string Username { get; set; } = "agritech_backend";

    /// <summary>
    /// Authenticated Mosquitto password (override via environment variable Mqtt__Password or User Secrets in production).
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Enables TLS/SSL transport encryption when connecting to a TLS-enabled broker listener.
    /// </summary>
    public bool UseTls { get; set; } = false;

    /// <summary>
    /// When false (default), establishes a persistent MQTT session so subscriptions and QoS 1/2 messages survive brief disconnects.
    /// </summary>
    public bool CleanSession { get; set; } = false;

    /// <summary>
    /// MQTT 5.0 Session Expiry Interval in seconds (default: 86400s = 24 hours).
    /// </summary>
    public uint SessionExpiryIntervalSeconds { get; set; } = 86_400;

    /// <summary>
    /// Keep-alive ping interval in seconds. Default is 30 seconds.
    /// </summary>
    public int KeepAliveSeconds { get; set; } = 30;

    /// <summary>
    /// Connection attempt timeout in seconds. Default is 10 seconds.
    /// </summary>
    public int ConnectTimeoutSeconds { get; set; } = 10;

    /// <summary>
    /// Initial delay in seconds before the first auto-reconnect attempt after disconnect.
    /// </summary>
    public int ReconnectInitialDelaySeconds { get; set; } = 2;

    /// <summary>
    /// Maximum backoff cap in seconds between auto-reconnect attempts.
    /// </summary>
    public int ReconnectMaxDelaySeconds { get; set; } = 60;

    /// <summary>
    /// Wildcard telemetry subscription topic established on connect/reconnect. Default: "agri/telemetry/#".
    /// </summary>
    public string TelemetryWildcardTopic { get; set; } = MqttTopics.TelemetryWildcard;
}
