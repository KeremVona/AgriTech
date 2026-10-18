using NetTopologySuite.Geometries;

namespace AgriTech.Api.Models;

public class CropScan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? ParcelId { get; set; }
    public Parcel? Parcel { get; set; }
    public Guid InferenceId { get; set; }
    public ModelInference Inference { get; set; } = null!;
    public Guid? UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public Point GeomPoint { get; set; } = null!;
    public decimal? GpsAccuracyMeters { get; set; }
    public string DetectionSource { get; set; } = "EXIF_GPS";
    public string? FieldNotes { get; set; }
    public DateTime ScannedAt { get; set; } = DateTime.UtcNow;
}
