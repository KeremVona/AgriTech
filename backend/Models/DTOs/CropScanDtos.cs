using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// Ingestion payload for submitting a foliar crop diagnostic scan from mobile devices or IoT camera nodes.
///
/// Ingestion behavior (BACK-206):
///   • When parcel_id is omitted or null, the backend automatically performs a PostGIS point-in-polygon
///     lookup using (latitude, longitude) against active parcels.
///   • If the coordinates land inside a parcel, parcel_id is auto-populated before persistence.
///   • If coordinates land outside all managed parcels, parcel_id is set to NULL without throwing unhandled exceptions.
/// </summary>
public class CreateCropScanRequest
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

    /// <summary>
    /// Public or pre-signed URL to the high-resolution RGB leaf scan image.
    /// </summary>
    [Required(ErrorMessage = "Image URL is required.")]
    [Url(ErrorMessage = "Image URL must be a valid URI.")]
    [JsonPropertyName("image_url")]
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>
    /// Foreign key referencing the ML diagnostic inference result in model_inferences table.
    /// </summary>
    [Required(ErrorMessage = "Inference ID is required.")]
    [JsonPropertyName("inference_id")]
    public Guid InferenceId { get; set; }

    /// <summary>
    /// Optional user ID of the inspector or agronomist who uploaded the scan.
    /// </summary>
    [JsonPropertyName("uploaded_by_user_id")]
    public Guid? UploadedByUserId { get; set; }

    /// <summary>
    /// Device GPS accuracy reading in meters.
    /// </summary>
    [Range(0.0, 1000.0, ErrorMessage = "GPS accuracy must be a positive number up to 1000 meters.")]
    [JsonPropertyName("gps_accuracy_meters")]
    public decimal? GpsAccuracyMeters { get; set; }

    /// <summary>
    /// Originating capture method: EXIF_GPS, MANUAL_PIN, RTK_ROVER, SENSOR_MOUNT.
    /// </summary>
    [MaxLength(30)]
    [JsonPropertyName("detection_source")]
    public string DetectionSource { get; set; } = "EXIF_GPS";

    /// <summary>
    /// Optional field inspection observations or notes from the operator.
    /// </summary>
    [JsonPropertyName("field_notes")]
    public string? FieldNotes { get; set; }

    /// <summary>
    /// Timestamp when the scan was captured in the field. Defaults to UtcNow if null.
    /// </summary>
    [JsonPropertyName("scanned_at")]
    public DateTime? ScannedAt { get; set; }

    /// <summary>
    /// Optional parcel ID override. If omitted or null, the API automatically resolves
    /// parcel_id using the spatial point-in-polygon reverse lookup (BACK-206).
    /// </summary>
    [JsonPropertyName("parcel_id")]
    public Guid? ParcelId { get; set; }
}

/// <summary>
/// Full response DTO for a persisted crop scan, enriched with spatial parcel context.
/// </summary>
public class CropScanResponseDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; init; }

    [JsonPropertyName("parcel_id")]
    public Guid? ParcelId { get; init; }

    [JsonPropertyName("parcel_name")]
    public string? ParcelName { get; init; }

    [JsonPropertyName("field_id")]
    public Guid? FieldId { get; init; }

    [JsonPropertyName("field_name")]
    public string? FieldName { get; init; }

    [JsonPropertyName("crop_id")]
    public Guid? CropId { get; init; }

    [JsonPropertyName("crop_name")]
    public string? CropName { get; init; }

    [JsonPropertyName("inference_id")]
    public Guid InferenceId { get; init; }

    [JsonPropertyName("uploaded_by_user_id")]
    public Guid? UploadedByUserId { get; init; }

    [JsonPropertyName("image_url")]
    public string ImageUrl { get; init; } = string.Empty;

    [JsonPropertyName("latitude")]
    public double Latitude { get; init; }

    [JsonPropertyName("longitude")]
    public double Longitude { get; init; }

    [JsonPropertyName("gps_accuracy_meters")]
    public decimal? GpsAccuracyMeters { get; init; }

    [JsonPropertyName("detection_source")]
    public string DetectionSource { get; init; } = string.Empty;

    [JsonPropertyName("field_notes")]
    public string? FieldNotes { get; init; }

    [JsonPropertyName("scanned_at")]
    public DateTime ScannedAt { get; init; }
}
