using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models;

public class SensorNode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ParcelId { get; set; }
    public Parcel Parcel { get; set; } = null!;
    public string HardwareUid { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Point GeomPoint { get; set; } = null!;
    public bool IsVirtual { get; set; } = true;
    public string Status { get; set; } = "ACTIVE";
    public decimal? BatteryLevelPct { get; set; }
    public DateTime InstalledAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastTelemetryAt { get; set; }
}
