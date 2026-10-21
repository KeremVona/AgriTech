namespace AgriTech.Api.Models.DTOs;

public class ParcelOverlapResult
{
    public Guid ConflictingParcelId { get; set; }
    public string ConflictingParcelName { get; set; } = string.Empty;
    public decimal OverlapAreaSqm { get; set; }
}
