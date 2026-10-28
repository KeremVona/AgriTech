using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using AgriTech.Api.Validation;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models.DTOs;

// ────────────────────────────────────────────────────────────────────────────
// REQUEST DTOs
// ────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Payload for creating a new parcel within a farm field.
///
/// Business rules enforced by the controller:
///   1. Parent field must exist (FK check → 404 if not found).
///   2. Parcel boundary must be spatially contained inside the parent field's boundary_geom.
///   3. Parcel must not overlap any sibling parcel in the same field (BACK-203 fn_check_parcel_overlap).
///
/// Geometry rules enforced by [ValidPolygon]:
///   • N >= 4 coordinates in the exterior ring
///   • Ring is closed (first == last coordinate)
///   • Polygon is topologically valid (no self-intersections)
/// </summary>
public class CreateParcelRequest
{
    [Required]
    [JsonPropertyName("field_id")]
    public Guid FieldId { get; set; }

    [Required]
    [JsonPropertyName("crop_id")]
    public Guid CropId { get; set; }

    [Required]
    [MaxLength(40)]
    [JsonPropertyName("soil_profile_id")]
    public string SoilProfileId { get; set; } = string.Empty;

    [Required]
    [MaxLength(80)]
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// GeoJSON Polygon geometry for the parcel boundary.
    /// Deserialized directly to NetTopologySuite.Geometries.Polygon via GeoJSON4STJ (BACK-204).
    /// </summary>
    [Required]
    [ValidPolygon]
    [JsonPropertyName("boundary_geom")]
    public Polygon BoundaryGeom { get; set; } = null!;

    [Required]
    [JsonPropertyName("planting_date")]
    public DateOnly PlantingDate { get; set; }

    [MaxLength(30)]
    [JsonPropertyName("irrigation_method")]
    public string IrrigationMethod { get; set; } = "DRIP";

    [Range(0.01, 100_000)]
    [JsonPropertyName("system_flow_rate_lpm")]
    public decimal SystemFlowRateLpm { get; set; } = 100.00m;

    [Range(0.01, 1.00)]
    [JsonPropertyName("irrigation_efficiency")]
    public decimal IrrigationEfficiency { get; set; } = 0.88m;
}

/// <summary>
/// Payload for updating a parcel.
/// Only non-null properties are applied (partial-update / PATCH semantics via PUT).
///
/// When BoundaryGeom is provided the controller:
///   1. Re-validates polygon geometry with [ValidPolygon].
///   2. Re-runs the spatial overlap check (excluding the current parcel itself).
///   3. EF Core writes the new geometry → the DB trigger recalculates area_hectares.
///   4. The updated bounding_box is recomputed and returned in the response.
/// </summary>
public class UpdateParcelRequest
{
    [MaxLength(80)]
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("crop_id")]
    public Guid? CropId { get; set; }

    [MaxLength(40)]
    [JsonPropertyName("soil_profile_id")]
    public string? SoilProfileId { get; set; }

    [ValidPolygon]
    [JsonPropertyName("boundary_geom")]
    public Polygon? BoundaryGeom { get; set; }

    [JsonPropertyName("planting_date")]
    public DateOnly? PlantingDate { get; set; }

    [Range(0.01, 1.00)]
    [JsonPropertyName("kc_current")]
    public decimal? KcCurrent { get; set; }

    [MaxLength(30)]
    [JsonPropertyName("irrigation_method")]
    public string? IrrigationMethod { get; set; }

    [Range(0.01, 100_000)]
    [JsonPropertyName("system_flow_rate_lpm")]
    public decimal? SystemFlowRateLpm { get; set; }

    [Range(0.01, 1.00)]
    [JsonPropertyName("irrigation_efficiency")]
    public decimal? IrrigationEfficiency { get; set; }
}

// ────────────────────────────────────────────────────────────────────────────
// RESPONSE DTOs
// ────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Full parcel entity representation returned by POST, PUT, and GET endpoints.
///
/// Key spatial fields:
///   • area_hectares — computed by the PostgreSQL calculate_parcel_area() trigger (BACK-202).
///   • bounding_box  — computed in-process from the polygon's EnvelopeInternal.
///   • boundary_geom — the full NetTopologySuite Polygon, serialized to RFC 7946 GeoJSON
///                     by the GeoJSON4STJ converter registered in Program.cs (BACK-204).
///
/// The boundary_geom is intentionally included so a single API call can populate both
/// a map layer (coordinates) and a sidebar panel (metadata) without additional round-trips.
/// </summary>
public class ParcelResponseDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; init; }

    [JsonPropertyName("field_id")]
    public Guid FieldId { get; init; }

    [JsonPropertyName("field_name")]
    public string? FieldName { get; init; }

    [JsonPropertyName("crop_id")]
    public Guid CropId { get; init; }

    [JsonPropertyName("crop_name")]
    public string? CropName { get; init; }

    [JsonPropertyName("soil_profile_id")]
    public string SoilProfileId { get; init; } = string.Empty;

    [JsonPropertyName("soil_profile_name")]
    public string? SoilProfileName { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Full GeoJSON Polygon geometry serialized as RFC 7946.
    /// SRID 4326 (WGS 84) — coordinates are [longitude, latitude] pairs.
    /// </summary>
    [JsonPropertyName("boundary_geom")]
    public Polygon BoundaryGeom { get; init; } = null!;

    /// <summary>
    /// Geodetic surface area in hectares — written by the PostgreSQL DB trigger.
    /// Formula: ROUND((ST_Area(boundary_geom::geography) / 10000.0)::numeric, 2)
    /// </summary>
    [JsonPropertyName("area_hectares")]
    public decimal AreaHectares { get; init; }

    /// <summary>
    /// Minimum enclosing bounding box computed from the polygon's envelope.
    /// Updated on every geometry write; returned immediately after PUT.
    /// </summary>
    [JsonPropertyName("bounding_box")]
    public BoundingBoxDto BoundingBox { get; init; } = null!;

    [JsonPropertyName("planting_date")]
    public DateOnly PlantingDate { get; init; }

    [JsonPropertyName("kc_current")]
    public decimal KcCurrent { get; init; }

    [JsonPropertyName("irrigation_method")]
    public string IrrigationMethod { get; init; } = string.Empty;

    [JsonPropertyName("system_flow_rate_lpm")]
    public decimal SystemFlowRateLpm { get; init; }

    [JsonPropertyName("irrigation_efficiency")]
    public decimal IrrigationEfficiency { get; init; }

    [JsonPropertyName("made_at")]
    public DateTime MadeAt { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; init; }
}
