namespace AgriTech.Api.Models.DTOs;

public class ParcelCoordinateLookupResult
{
    public Guid ParcelId { get; set; }
    public string ParcelName { get; set; } = string.Empty;
    public Guid FieldId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public Guid CropId { get; set; }
    public string CropName { get; set; } = string.Empty;
    public string SoilProfileId { get; set; } = string.Empty;
    public string SoilProfileName { get; set; } = string.Empty;
    public DateOnly PlantingDate { get; set; }
    public decimal AreaHectares { get; set; }
    public decimal KcCurrent { get; set; }
}
