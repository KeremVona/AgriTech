using System.Text.Json;
using System.Text.Json.Serialization;

namespace AgriTech.Api.Messaging;

/// <summary>
/// Standardized UPPERCASE action codes for valve actuator commands published on agri/actuator/{parcelId}/valve.
/// </summary>
public static class ValveActionConstants
{
    public const string TriggerOpen = "VALVE_TRIGGER_OPEN";
    public const string TriggerClose = "VALVE_TRIGGER_CLOSE";

    public static bool IsValid(string? action) =>
        string.Equals(action, TriggerOpen, StringComparison.Ordinal) ||
        string.Equals(action, TriggerClose, StringComparison.Ordinal);
}

/// <summary>
/// Standardized IoT soil sensor telemetry payload published on agri/telemetry/{parcelId} (Phase 3 Spec).
/// </summary>
public sealed class SensorTelemetryMessage
{
    [JsonPropertyName("node_id")]
    public string NodeId { get; init; } = string.Empty;

    [JsonPropertyName("parcel_id")]
    public Guid ParcelId { get; init; }

    [JsonPropertyName("timestamp")]
    public DateTimeOffset Timestamp { get; init; }

    [JsonPropertyName("soil_moisture_pct")]
    public decimal SoilMoisturePct { get; init; }

    [JsonPropertyName("soil_temperature_c")]
    public decimal SoilTemperatureC { get; init; }

    [JsonPropertyName("ambient_humidity_pct")]
    public decimal? AmbientHumidityPct { get; init; }

    [JsonPropertyName("battery_voltage")]
    public decimal BatteryVoltage { get; init; }
}

/// <summary>
/// Standardized valve actuation command payload published on agri/actuator/{parcelId}/valve (Phase 3 Spec).
/// </summary>
public sealed class ValveActuationCommand
{
    [JsonPropertyName("event_id")]
    public Guid EventId { get; init; }

    [JsonPropertyName("parcel_id")]
    public Guid ParcelId { get; init; }

    [JsonPropertyName("action")]
    public string Action { get; init; } = ValveActionConstants.TriggerOpen;

    [JsonPropertyName("duration_seconds")]
    public int DurationSeconds { get; init; }

    [JsonPropertyName("target_volume_liters")]
    public decimal TargetVolumeLiters { get; init; }

    [JsonPropertyName("reason")]
    public string Reason { get; init; } = string.Empty;
}

/// <summary>
/// Envelope passed to registered telemetry message handlers (consumed by TODO-306 ingestion worker).
/// </summary>
public sealed record TelemetryMessageEnvelope(
    string Topic,
    Guid ParcelId,
    SensorTelemetryMessage Payload,
    DateTime ReceivedAtUtc);

/// <summary>
/// Shared JSON serializer/deserializer for MQTT message contracts.
/// </summary>
public static class MqttMessageSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static string Serialize<T>(T payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        return JsonSerializer.Serialize(payload, Options);
    }

    public static bool TryDeserialize<T>(ReadOnlySpan<byte> utf8Bytes, out T? result) where T : class
    {
        result = null;
        if (utf8Bytes.IsEmpty)
        {
            return false;
        }

        try
        {
            result = JsonSerializer.Deserialize<T>(utf8Bytes, Options);
            return result is not null;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static bool TryDeserialize<T>(string? json, out T? result) where T : class
    {
        result = null;
        if (string.IsNullOrWhiteSpace(json))
        {
            return false;
        }

        try
        {
            result = JsonSerializer.Deserialize<T>(json, Options);
            return result is not null;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
