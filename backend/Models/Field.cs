using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models;

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
