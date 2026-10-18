using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models;

public class Parcel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FieldId { get; set; }
    public Field Field { get; set; } = null!;
    public Guid CropId { get; set; }
    public Crop Crop { get; set; } = null!;
    public string SoilProfileId { get; set; } = string.Empty;
    public SoilProfile SoilProfile { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public Polygon BoundaryGeom { get; set; } = null!;
    public decimal AreaHectares { get; set; } = 0.00m;
    public DateOnly PlantingDate { get; set; }
    public decimal KcCurrent { get; set; } = 0.40m;
    public string IrrigationMethod { get; set; } = "DRIP";
    public decimal SystemFlowRateLpm { get; set; } = 100.00m;
    public decimal IrrigationEfficiency { get; set; } = 0.88m;
    public DateTime MadeAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SensorNode> SensorNodes { get; set; } = new List<SensorNode>();
    public ICollection<CropScan> CropScans { get; set; } = new List<CropScan>();
}
