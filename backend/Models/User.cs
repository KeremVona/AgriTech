namespace AgriTech.Api.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "FARM_OWNER";
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime MadeAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Field> Fields { get; set; } = new List<Field>();
    public ICollection<CropScan> UploadedCropScans { get; set; } = new List<CropScan>();
}
