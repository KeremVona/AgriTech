using AgriTech.Api.Data;
using AgriTech.Api.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AgriTech.Api.Services;

/// <summary>
/// Projects only required scalar columns (avoiding PostGIS BoundaryGeom over-fetching)
/// from parcels, crops, and weather_cache to compute live parcel phenology and ETc.
/// </summary>
public class ParcelPhenologyQueryService : IParcelPhenologyQueryService
{
    private readonly AgriTechDbContext _dbContext;
    private readonly ICropPhenologyService _phenologyService;
    private readonly ILogger<ParcelPhenologyQueryService> _logger;

    public ParcelPhenologyQueryService(
        AgriTechDbContext dbContext,
        ICropPhenologyService phenologyService,
        ILogger<ParcelPhenologyQueryService> logger)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _phenologyService = phenologyService ?? throw new ArgumentNullException(nameof(phenologyService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<ParcelPhenologyResponseDto?> GetParcelPhenologyAsync(
        Guid parcelId,
        DateOnly targetDate,
        CancellationToken cancellationToken = default)
    {
        // Project only scalar fields — intentionally omits PostGIS BoundaryGeom polygon
        var parcel = await _dbContext.Parcels
            .AsNoTracking()
            .Where(p => p.Id == parcelId)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.PlantingDate,
                CropName = p.Crop.CommonName,
                p.Crop.DefaultRootDepthMaxM
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (parcel is null)
        {
            return null;
        }

        var weatherEntry = await _dbContext.WeatherCaches
            .AsNoTracking()
            .Where(w => w.ParcelId == parcelId && w.ForecastDate == targetDate)
            .Select(w => new { w.ForecastDate, w.Et0Mm })
            .FirstOrDefaultAsync(cancellationToken);

        var assessment = _phenologyService.AssessCropPhenology(
            parcel.CropName,
            parcel.PlantingDate,
            targetDate,
            et0Mm: weatherEntry?.Et0Mm,
            maxRootDepthOverrideM: parcel.DefaultRootDepthMaxM);

        _logger.LogInformation(
            "Computed phenology for parcel {ParcelId} ({Crop}, DAP={Dap}): Stage={Stage}, Kc={Kc}, ETc={Etc}",
            parcel.Id, parcel.CropName, assessment.DaysAfterPlanting, assessment.Stage, assessment.Kc, assessment.EtcMm);

        return new ParcelPhenologyResponseDto
        {
            ParcelId = parcel.Id,
            ParcelName = parcel.Name,
            CalculatedAtUtc = DateTime.UtcNow,
            WeatherSourceDate = weatherEntry?.ForecastDate,
            Assessment = assessment
        };
    }
}
