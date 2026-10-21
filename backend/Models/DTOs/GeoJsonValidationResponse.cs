using System.Text.Json.Serialization;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// Response payload verifying that an incoming GeoJSON geometry was deserialized cleanly into a NetTopologySuite geometry instance.
/// </summary>
public class GeoJsonValidationResponse
{
    [JsonPropertyName("is_valid")]
    public bool IsValid { get; set; }

    [JsonPropertyName("geometry_type")]
    public string GeometryType { get; set; } = string.Empty;

    [JsonPropertyName("srid")]
    public int Srid { get; set; }

    [JsonPropertyName("coordinate_count")]
    public int CoordinateCount { get; set; }

    [JsonPropertyName("area_degrees")]
    public double AreaDegrees { get; set; }

    [JsonPropertyName("centroid")]
    public CentroidDto? Centroid { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}

public class CentroidDto
{
    [JsonPropertyName("longitude")]
    public double Longitude { get; set; }

    [JsonPropertyName("latitude")]
    public double Latitude { get; set; }
}
