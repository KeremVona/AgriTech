using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// General test DTO for accepting various NetTopologySuite spatial types directly from GeoJSON.
/// </summary>
public class GeometryTestRequest
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("polygon")]
    public Polygon? Polygon { get; set; }

    [JsonPropertyName("point")]
    public Point? Point { get; set; }

    [JsonPropertyName("geometry")]
    public Geometry? Geometry { get; set; }
}
