using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// Payload for reverse-geotagging a GPS coordinate pair to find its enclosing managed parcel.
/// Used by mobile foliar inspection apps, UAV field telemetry, and IoT sensor installer devices.
/// </summary>
public class LocateCoordinateRequest
{
    /// <summary>
    /// WGS 84 Latitude in decimal degrees (-90.0 to +90.0).
    /// </summary>
    [Required(ErrorMessage = "Latitude is required.")]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90.0 and 90.0 degrees.")]
    [JsonPropertyName("latitude")]
    public double Latitude { get; set; }

    /// <summary>
    /// WGS 84 Longitude in decimal degrees (-180.0 to +180.0).
    /// </summary>
    [Required(ErrorMessage = "Longitude is required.")]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180.0 and 180.0 degrees.")]
    [JsonPropertyName("longitude")]
    public double Longitude { get; set; }
}
