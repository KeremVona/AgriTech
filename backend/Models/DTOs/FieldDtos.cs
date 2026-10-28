using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using AgriTech.Api.Validation;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models.DTOs;

// ────────────────────────────────────────────────────────────────────────────
// REQUEST DTOs
// ────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Payload for creating a new farm field.
/// The boundary_geom is deserialized directly into a NetTopologySuite Polygon
/// by the GeoJSON4STJ converter registered in Program.cs (BACK-204).
/// </summary>
public class CreateFieldRequest
{
    [Required]
    [JsonPropertyName("owner_id")]
    public Guid OwnerId { get; set; }

    [Required]
    [MaxLength(120)]
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(150)]
    [JsonPropertyName("location_name")]
    public string? LocationName { get; set; }

    /// <summary>
    /// GeoJSON Polygon geometry.  Validated by [ValidPolygon]:
    ///   • N >= 4 coordinates
    ///   • Ring closed (first == last coordinate)
    ///   • Topologically valid (no self-intersections)
    /// </summary>
    [Required]
    [ValidPolygon]
    [JsonPropertyName("boundary_geom")]
    public Polygon BoundaryGeom { get; set; } = null!;
}

/// <summary>
/// Payload for partially updating an existing field (PATCH / PUT semantics).
/// Only non-null properties are applied.
/// </summary>
public class UpdateFieldRequest
{
    [MaxLength(120)]
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [MaxLength(150)]
    [JsonPropertyName("location_name")]
    public string? LocationName { get; set; }

    [ValidPolygon]
    [JsonPropertyName("boundary_geom")]
    public Polygon? BoundaryGeom { get; set; }
}

// ────────────────────────────────────────────────────────────────────────────
// RESPONSE DTOs
// ────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Complete field entity representation returned to clients.
/// Includes spatial metadata (bounding box, total area) and parcel summary.
/// </summary>
public class FieldResponseDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("owner_id")]
    public Guid OwnerId { get; init; }

    [JsonPropertyName("location_name")]
    public string? LocationName { get; init; }

    /// <summary>
    /// Geodetic surface area automatically computed by the PostgreSQL
    /// calculate_field_area() trigger (BACK-202) using ST_Area(boundary_geom::geography) / 10000.
    /// </summary>
    [JsonPropertyName("total_area_hectares")]
    public decimal TotalAreaHectares { get; init; }

    /// <summary>
    /// Minimum enclosing rectangle of the field boundary.
    /// Computed in-process from the polygon's EnvelopeInternal without an extra DB round-trip.
    /// </summary>
    [JsonPropertyName("bounding_box")]
    public BoundingBoxDto BoundingBox { get; init; } = null!;

    /// <summary>
    /// Number of parcels associated with this field (included when loaded with .Include(f => f.Parcels)).
    /// </summary>
    [JsonPropertyName("parcel_count")]
    public int ParcelCount { get; init; }

    [JsonPropertyName("made_at")]
    public DateTime MadeAt { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; init; }

    /// <summary>
    /// Summarised parcel list — included only on GET /{id} (detail view).
    /// Null on list endpoints to reduce payload size.
    /// </summary>
    [JsonPropertyName("parcels")]
    public IReadOnlyList<ParcelSummaryDto>? Parcels { get; init; }
}

/// <summary>
/// Compact parcel summary embedded inside a FieldResponseDto.
/// Does not include the full geometry; use GET /api/v1/fields/{id}/parcels for that.
/// </summary>
public class ParcelSummaryDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("crop_name")]
    public string? CropName { get; init; }

    [JsonPropertyName("area_hectares")]
    public decimal AreaHectares { get; init; }

    [JsonPropertyName("planting_date")]
    public DateOnly PlantingDate { get; init; }
}
