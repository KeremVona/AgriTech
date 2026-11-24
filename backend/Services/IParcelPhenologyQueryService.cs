using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Services;

/// <summary>
/// Scoped query service resolving parcel phenology and live crop evapotranspiration (ETc = Kc * ET0)
/// by projecting lightweight scalar columns from parcels, crops, and weather_cache (BACK-301 + BACK-302).
/// </summary>
public interface IParcelPhenologyQueryService
{
    /// <summary>
    /// Computes the phenological assessment for a registered parcel on the target date,
    /// enriching it with cached Open-Meteo ET0 when available.
    /// Returns null if the parcel does not exist.
    /// </summary>
    Task<ParcelPhenologyResponseDto?> GetParcelPhenologyAsync(
        Guid parcelId,
        DateOnly targetDate,
        CancellationToken cancellationToken = default);
}
