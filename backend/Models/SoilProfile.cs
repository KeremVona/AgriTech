namespace AgriTech.Api.Models;

public class SoilProfile
{
    public string Id { get; set; } = string.Empty; // e.g., sandy_loam, clay, silt_loam, loam
    public string Name { get; set; } = string.Empty;
    public decimal FieldCapacityPct { get; set; }
    public decimal WiltingPointPct { get; set; }
    public decimal SaturationPct { get; set; }
    public decimal HydraulicConductivity { get; set; }
    public decimal MadThresholdPct { get; set; } = 0.50m;

    public ICollection<Parcel> Parcels { get; set; } = new List<Parcel>();
}
