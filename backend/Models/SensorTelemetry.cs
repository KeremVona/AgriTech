namespace AgriTech.Api.Models;

/// <summary>
/// Entity mapped to the 'sensor_telemetry' time-series table (Module 5: IoT Probes &amp; Telemetry Stream).
/// </summary>
public class SensorTelemetry
{
    public long Id { get; set; }

    public Guid ParcelId { get; set; }
    public Parcel Parcel { get; set; } = null!;

    public Guid NodeId { get; set; }
    public SensorNode Node { get; set; } = null!;

    /// <summary>
    /// UTC capture timestamp of the soil moisture reading.
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Volumetric water content percentage (VWC %, e.g. 24.30).
    /// </summary>
    public decimal SoilMoisturePct { get; set; }

    /// <summary>
    /// Soil temperature (°C).
    /// </summary>
    public decimal SoilTempC { get; set; }

    /// <summary>
    /// Optional ambient relative humidity (%).
    /// </summary>
    public decimal? AmbientHumidityPct { get; set; }

    /// <summary>
    /// Sensor node battery voltage (V).
    /// </summary>
    public decimal BatteryVoltage { get; set; }
}
