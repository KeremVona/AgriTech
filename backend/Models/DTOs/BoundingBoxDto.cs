using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// RFC 7946-compliant bounding box representation for a spatial geometry.
/// Expresses the minimum enclosing rectangle of a polygon or point geometry
/// as [minLongitude, minLatitude, maxLongitude, maxLatitude].
///
/// Used by GIS map clients (Leaflet fitBounds, Mapbox fitBounds, OpenLayers)
/// to automatically zoom and pan to the spatial feature's extent.
/// </summary>
public class BoundingBoxDto
{
    /// <summary>Minimum longitude (westernmost extent) in decimal degrees WGS 84.</summary>
    [JsonPropertyName("min_longitude")]
    public double MinLongitude { get; init; }

    /// <summary>Minimum latitude (southernmost extent) in decimal degrees WGS 84.</summary>
    [JsonPropertyName("min_latitude")]
    public double MinLatitude { get; init; }

    /// <summary>Maximum longitude (easternmost extent) in decimal degrees WGS 84.</summary>
    [JsonPropertyName("max_longitude")]
    public double MaxLongitude { get; init; }

    /// <summary>Maximum latitude (northernmost extent) in decimal degrees WGS 84.</summary>
    [JsonPropertyName("max_latitude")]
    public double MaxLatitude { get; init; }

    /// <summary>
    /// Flat RFC 7946 bbox array: [minLng, minLat, maxLng, maxLat].
    /// Ready for direct insertion into GeoJSON FeatureCollection or Feature bbox field.
    /// </summary>
    [JsonPropertyName("bbox")]
    public double[] Bbox => [MinLongitude, MinLatitude, MaxLongitude, MaxLatitude];

    /// <summary>
    /// Constructs a BoundingBoxDto from a NetTopologySuite Geometry envelope.
    /// </summary>
    public static BoundingBoxDto FromGeometry(Geometry geometry)
    {
        var env = geometry.EnvelopeInternal;
        return new BoundingBoxDto
        {
            MinLongitude = env.MinX,
            MinLatitude  = env.MinY,
            MaxLongitude = env.MaxX,
            MaxLatitude  = env.MaxY
        };
    }
}
