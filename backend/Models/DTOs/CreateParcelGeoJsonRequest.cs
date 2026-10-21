using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// DTO representing an incoming parcel creation payload containing a GeoJSON Polygon geometry.
/// Deserialized automatically by NetTopologySuite.IO.GeoJSON4STJ directly into a NetTopologySuite.Geometries.Polygon.
/// </summary>
public class CreateParcelGeoJsonRequest
{
    [JsonPropertyName("field_id")]
    public Guid FieldId { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("crop_id")]
    public Guid CropId { get; set; }

    [JsonPropertyName("soil_profile_id")]
    public string SoilProfileId { get; set; } = string.Empty;

    [JsonPropertyName("planting_date")]
    public DateOnly PlantingDate { get; set; }

    [JsonPropertyName("irrigation_method")]
    public string IrrigationMethod { get; set; } = "DRIP";

    [JsonPropertyName("system_flow_rate_lpm")]
    public decimal SystemFlowRateLpm { get; set; } = 100.00m;

    [JsonPropertyName("irrigation_efficiency")]
    public decimal IrrigationEfficiency { get; set; } = 0.88m;

    [JsonPropertyName("geometry")]
    public Polygon Geometry { get; set; } = null!;
}
