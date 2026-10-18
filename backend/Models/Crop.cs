namespace AgriTech.Api.Models;

public class Crop
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CommonName { get; set; } = string.Empty;
    public string? ScientificName { get; set; }
    public string? Family { get; set; }
    public decimal DefaultRootDepthMaxM { get; set; } = 0.60m;
    public DateTime MadeAt { get; set; } = DateTime.UtcNow;

    public ICollection<Parcel> Parcels { get; set; } = new List<Parcel>();
}
