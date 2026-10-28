using System.ComponentModel.DataAnnotations;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Validation;

/// <summary>
/// Custom DataAnnotations validation attribute enforcing RFC 7946 and PostGIS polygon integrity rules.
/// Applied to NetTopologySuite.Geometries.Polygon properties on request DTOs.
///
/// Enforces three geometrical correctness conditions:
///   1. Minimum coordinate count: N >= 4 (3 unique vertices + 1 closure point).
///   2. Ring closure: first coordinate must equal last coordinate.
///   3. Self-intersection (NTS IsValid): polygon must not cross itself.
///
/// Any violation short-circuits further processing and returns HTTP 400 Bad Request.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class ValidPolygonAttribute : ValidationAttribute
{
    /// <summary>Minimum number of coordinates in the exterior ring (inclusive of closure point).</summary>
    public int MinCoordinates { get; init; } = 4;

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        // Null is allowed — use [Required] separately if the field is mandatory
        if (value is null)
            return ValidationResult.Success;

        if (value is not Polygon polygon)
            return new ValidationResult($"The field {validationContext.DisplayName} must be a valid GeoJSON Polygon.");

        var ring = polygon.ExteriorRing;
        if (ring is null)
            return new ValidationResult($"{validationContext.DisplayName}: Polygon exterior ring is missing.");

        var coords = ring.Coordinates;

        // Rule 1 — Minimum coordinate count (N >= 4)
        if (coords.Length < MinCoordinates)
        {
            return new ValidationResult(
                $"{validationContext.DisplayName}: Polygon exterior ring must contain at least {MinCoordinates} " +
                $"coordinates (got {coords.Length}). A valid polygon needs at least 3 distinct vertices plus " +
                $"a closure coordinate that repeats the first.");
        }

        // Rule 2 — Ring closure: first == last coordinate pair
        var first = coords[0];
        var last = coords[^1];
        if (first.X != last.X || first.Y != last.Y)
        {
            return new ValidationResult(
                $"{validationContext.DisplayName}: Polygon is not closed. The first coordinate " +
                $"[{first.X}, {first.Y}] must equal the last coordinate [{last.X}, {last.Y}].");
        }

        // Rule 3 — Topological validity (no self-intersections, degenerate rings)
        if (!polygon.IsValid)
        {
            var reason = new NetTopologySuite.Operation.Valid.IsValidOp(polygon).ValidationError?.Message
                         ?? "geometry is topologically invalid";
            return new ValidationResult(
                $"{validationContext.DisplayName}: Polygon geometry is invalid — {reason}. " +
                $"Ensure the polygon does not self-intersect (e.g., figure-8 / butterfly shapes are not allowed).");
        }

        return ValidationResult.Success;
    }
}
