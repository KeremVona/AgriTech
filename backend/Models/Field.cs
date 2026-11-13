using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models;

/// <summary>
/// Represents an overarching agricultural landholding or farm perimeter boundary.
/// TODO (Finding 8): When field update endpoints (PUT/PATCH /api/v1/fields/{id}) are introduced,
/// attach a BEFORE UPDATE OF boundary_geom ON fields trigger to reject perimeter shrinking
/// if any existing child parcel is not completely covered (ST_Covers(NEW.boundary_geom, p.boundary_geom)).
/// </summary>
public class Field
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public Polygon BoundaryGeom { get; set; } = null!;
    public decimal TotalAreaHectares { get; set; } = 0.00m;
    public string? LocationName { get; set; }
    public DateTime MadeAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Parcel> Parcels { get; set; } = new List<Parcel>();
}
