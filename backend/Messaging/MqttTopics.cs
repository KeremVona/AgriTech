namespace AgriTech.Api.Messaging;

/// <summary>
/// Standardized MQTT topic builders and strict parsers for Precision AgriTech IoT messaging (BACK-304).
///
/// Topic taxonomy (Phase 3 Spec):
///   - Sensor telemetry (per parcel): agri/telemetry/{parcelId}
///   - Backend wildcard subscription: agri/telemetry/#
///   - Valve actuation commands:      agri/actuator/{parcelId}/valve
/// </summary>
public static class MqttTopics
{
    public const string RootNamespace = "agri";
    public const string TelemetrySegment = "telemetry";
    public const string ActuatorSegment = "actuator";
    public const string ValveSegment = "valve";

    public const string TelemetryWildcard = "agri/telemetry/#";
    public const string ActuatorValveWildcard = "agri/actuator/+/valve";
    public const string HealthCheckTopic = "agri/health/check";

    /// <summary>
    /// Builds the canonical sensor telemetry topic for a specific parcel: agri/telemetry/{parcelId}.
    /// </summary>
    public static string TelemetryForParcel(Guid parcelId)
    {
        if (parcelId == Guid.Empty)
        {
            throw new ArgumentException("Parcel ID cannot be empty.", nameof(parcelId));
        }

        return $"{RootNamespace}/{TelemetrySegment}/{parcelId:D}";
    }

    /// <summary>
    /// Builds the canonical valve actuator command topic for a specific parcel: agri/actuator/{parcelId}/valve.
    /// </summary>
    public static string ValveActuatorForParcel(Guid parcelId)
    {
        if (parcelId == Guid.Empty)
        {
            throw new ArgumentException("Parcel ID cannot be empty.", nameof(parcelId));
        }

        return $"{RootNamespace}/{ActuatorSegment}/{parcelId:D}/{ValveSegment}";
    }

    /// <summary>
    /// Attempts to extract a valid non-empty parcel UUID from a telemetry topic (agri/telemetry/{parcelId}).
    /// Rejects wildcard characters, extra topic segmentsS or malformed GUIDs.
    /// </summary>
    public static bool TryExtractParcelIdFromTelemetryTopic(string? topic, out Guid parcelId)
    {
        parcelId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(topic))
        {
            return false;
        }

        var parts = topic.Split('/');
        if (parts.Length != 3 ||
            !string.Equals(parts[0], RootNamespace, StringComparison.Ordinal) ||
            !string.Equals(parts[1], TelemetrySegment, StringComparison.Ordinal))
        {
            return false;
        }

        return Guid.TryParseExact(parts[2], "D", out parcelId) && parcelId != Guid.Empty;
    }

    /// <summary>
    /// Attempts to extract a valid non-empty parcel UUID from a valve actuator topic (agri/actuator/{parcelId}/valve).
    /// </summary>
    public static bool TryExtractParcelIdFromActuatorTopic(string? topic, out Guid parcelId)
    {
        parcelId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(topic))
        {
            return false;
        }

        var parts = topic.Split('/');
        if (parts.Length != 4 ||
            !string.Equals(parts[0], RootNamespace, StringComparison.Ordinal) ||
            !string.Equals(parts[1], ActuatorSegment, StringComparison.Ordinal) ||
            !string.Equals(parts[3], ValveSegment, StringComparison.Ordinal))
        {
            return false;
        }

        return Guid.TryParseExact(parts[2], "D", out parcelId) && parcelId != Guid.Empty;
    }
}
