using System.Diagnostics;
using System.Globalization;
using AgriTech.Api.Data;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AgriTech.Api.Services;

/// <summary>
/// Core implementation of the meteorological ingestion engine.
/// Reads parcel centroids, executes resilient Open-Meteo calls and writes entries to weather_cache.
/// Guarantees idempotency and zero duplicate records via composite key (parcel_id, forecast_date) upsert logic.
/// </summary>
public class WeatherIngestionService : IWeatherIngestionService
{
    private readonly AgriTechDbContext _dbContext;
    private readonly IOpenMeteoClient _openMeteoClient;
    private readonly ILogger<WeatherIngestionService> _logger;

    public WeatherIngestionService(
        AgriTechDbContext dbContext,
        IOpenMeteoClient openMeteoClient,
        ILogger<WeatherIngestionService> logger)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _openMeteoClient = openMeteoClient ?? throw new ArgumentNullException(nameof(openMeteoClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<WeatherIngestionSummaryDto> IngestDailyForecastForAllParcelsAsync(CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var summary = new WeatherIngestionSummaryDto();

        _logger.LogInformation("Starting weather ingestion pipeline for all parcels...");

        // 1. Retrieve all parcels with their PostGIS polygon centroids
        var parcels = await _dbContext.Parcels
            .AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.Name,
                CentroidLat = p.BoundaryGeom.Centroid.Y,
                CentroidLng = p.BoundaryGeom.Centroid.X
            })
            .ToListAsync(cancellationToken);

        _logger.LogInformation("Discovered {ParcelCount} parcels for meteorological ingestion.", parcels.Count);

        foreach (var parcel in parcels)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var parcelResult = await IngestParcelInternalAsync(
                    parcel.Id,
                    parcel.Name,
                    parcel.CentroidLat,
                    parcel.CentroidLng,
                    cancellationToken);

                summary.ParcelsProcessed++;
                summary.RecordsIngested += parcelResult.Ingested;
                summary.RecordsUpdated += parcelResult.Updated;
            }
            catch (Exception ex)
            {
                summary.FailedParcels++;
                var errorMsg = $"Parcel '{parcel.Name}' ({parcel.Id}) ingestion failed: {ex.Message}";
                summary.Errors.Add(errorMsg);
                _logger.LogError(ex, "Failed to ingest weather for parcel '{ParcelName}' ({ParcelId}). Continuing next parcel...", parcel.Name, parcel.Id);
            }
        }

        stopwatch.Stop();
        summary.ExecutionDurationMs = stopwatch.ElapsedMilliseconds;

        _logger.LogInformation(
            "Weather ingestion run completed in {DurationMs}ms. Processed: {Processed}, Ingested: {Ingested}, Updated: {Updated}, Failed: {Failed}",
            summary.ExecutionDurationMs, summary.ParcelsProcessed, summary.RecordsIngested, summary.RecordsUpdated, summary.FailedParcels);

        return summary;
    }

    /// <inheritdoc />
    public async Task<WeatherIngestionSummaryDto> IngestDailyForecastForParcelAsync(Guid parcelId, CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var summary = new WeatherIngestionSummaryDto();

        var parcel = await _dbContext.Parcels
            .AsNoTracking()
            .Where(p => p.Id == parcelId)
            .Select(p => new
            {
                p.Id,
                p.Name,
                CentroidLat = p.BoundaryGeom.Centroid.Y,
                CentroidLng = p.BoundaryGeom.Centroid.X
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (parcel == null)
        {
            summary.FailedParcels = 1;
            summary.Errors.Add($"Parcel with ID '{parcelId}' was not found.");
            return summary;
        }

        try
        {
            var result = await IngestParcelInternalAsync(
                parcel.Id,
                parcel.Name,
                parcel.CentroidLat,
                parcel.CentroidLng,
                cancellationToken);

            summary.ParcelsProcessed = 1;
            summary.RecordsIngested = result.Ingested;
            summary.RecordsUpdated = result.Updated;
        }
        catch (Exception ex)
        {
            summary.FailedParcels = 1;
            summary.Errors.Add($"Parcel '{parcel.Name}' ({parcel.Id}) ingestion failed: {ex.Message}");
            _logger.LogError(ex, "Failed to ingest weather for single parcel '{ParcelName}' ({ParcelId})", parcel.Name, parcel.Id);
        }

        stopwatch.Stop();
        summary.ExecutionDurationMs = stopwatch.ElapsedMilliseconds;
        return summary;
    }

    /// <inheritdoc />
    public async Task<ParcelWeatherResponseDto?> GetParcelWeatherAsync(Guid parcelId, CancellationToken cancellationToken = default)
    {
        var parcel = await _dbContext.Parcels
            .AsNoTracking()
            .Where(p => p.Id == parcelId)
            .Select(p => new
            {
                p.Id,
                p.Name,
                CentroidLat = p.BoundaryGeom.Centroid.Y,
                CentroidLng = p.BoundaryGeom.Centroid.X
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (parcel == null)
        {
            return null;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDate = today.AddDays(-1);

        var metrics = await _dbContext.WeatherCaches
            .AsNoTracking()
            .Where(w => w.ParcelId == parcelId && w.ForecastDate >= startDate)
            .OrderBy(w => w.ForecastDate)
            .Select(w => new DailyWeatherMetricDto
            {
                Id = w.Id,
                ForecastDate = w.ForecastDate,
                IsForecast = w.IsForecast,
                Et0Mm = w.Et0Mm,
                PrecipitationMm = w.PrecipitationMm,
                EffectivePrecipitationMm = w.EffectivePrecipitationMm,
                TempMinC = w.TempMinC,
                TempMaxC = w.TempMaxC,
                RelativeHumidityAvgPct = w.RelativeHumidityAvgPct,
                SolarRadiationMj = w.SolarRadiationMj,
                WindSpeedMs = w.WindSpeedMs,
                IngestedAt = w.IngestedAt
            })
            .ToListAsync(cancellationToken);

        return new ParcelWeatherResponseDto
        {
            ParcelId = parcel.Id,
            ParcelName = parcel.Name,
            CentroidLatitude = parcel.CentroidLat,
            CentroidLongitude = parcel.CentroidLng,
            Metrics = metrics
        };
    }

    /// <inheritdoc />
    public async Task<bool> ParcelExistsAsync(Guid parcelId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Parcels
            .AsNoTracking()
            .AnyAsync(p => p.Id == parcelId, cancellationToken);
    }

    private async Task<(int Ingested, int Updated)> IngestParcelInternalAsync(
        Guid parcelId,
        string parcelName,
        double lat,
        double lng,
        CancellationToken cancellationToken)
    {
        var forecastResponse = await _openMeteoClient.GetDailyForecastAsync(lat, lng, forecastDays: 7, cancellationToken: cancellationToken);
        var daily = forecastResponse.Daily;

        if (daily == null || daily.Time.Count == 0)
        {
            _logger.LogWarning("No daily forecast records returned for parcel '{ParcelName}' ({ParcelId}).", parcelName, parcelId);
            return (0, 0);
        }

        // Pair each valid parsed date with its exact array index to prevent silent index desynchronization
        var validEntries = new List<(DateOnly Date, int Index)>();
        for (int i = 0; i < daily.Time.Count; i++)
        {
            if (DateOnly.TryParseExact(daily.Time[i], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                validEntries.Add((date, i));
            }
            else
            {
                _logger.LogWarning(
                    "Unable to parse forecast date '{TimeStr}' at index {Index} for parcel '{ParcelName}'. Skipping record.",
                    daily.Time[i], i, parcelName);
            }
        }

        var dates = validEntries.Select(e => e.Date).ToList();

        // Query existing cached entries for this parcel and these dates to prevent duplicates
        var existingCacheEntries = await _dbContext.WeatherCaches
            .Where(w => w.ParcelId == parcelId && dates.Contains(w.ForecastDate))
            .ToDictionaryAsync(w => w.ForecastDate, cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        int ingestedCount = 0;
        int updatedCount = 0;

        foreach (var (forecastDate, i) in validEntries)
        {
            var et0 = i < daily.Et0FaoEvapotranspiration.Count ? daily.Et0FaoEvapotranspiration[i] : 0.00m;
            var precipitation = i < daily.PrecipitationSum.Count ? daily.PrecipitationSum[i] : 0.00m;
            var effectivePrecipitation = WeatherCache.CalculateEffectivePrecipitation(precipitation);
            var tempMax = i < daily.Temperature2mMax.Count ? daily.Temperature2mMax[i] : 0.0m;
            var tempMin = i < daily.Temperature2mMin.Count ? daily.Temperature2mMin[i] : 0.0m;
            var relativeHumidity = daily.RelativeHumidity2mMean != null && i < daily.RelativeHumidity2mMean.Count
                ? daily.RelativeHumidity2mMean[i]
                : null;
            var solarRadiation = daily.ShortwaveRadiationSum != null && i < daily.ShortwaveRadiationSum.Count
                ? daily.ShortwaveRadiationSum[i]
                : null;
            var windSpeed = daily.WindSpeed10mMax != null && i < daily.WindSpeed10mMax.Count
                ? daily.WindSpeed10mMax[i]
                : null;
            var isForecast = forecastDate >= today;

            if (existingCacheEntries.TryGetValue(forecastDate, out var existingRecord))
            {
                // Update existing record (Idempotent: avoids violating uq_weather_parcel_date constraint)
                existingRecord.Et0Mm = et0;
                existingRecord.PrecipitationMm = precipitation;
                existingRecord.EffectivePrecipitationMm = effectivePrecipitation;
                existingRecord.TempMaxC = tempMax;
                existingRecord.TempMinC = tempMin;
                existingRecord.RelativeHumidityAvgPct = relativeHumidity;
                existingRecord.SolarRadiationMj = solarRadiation;
                existingRecord.WindSpeedMs = windSpeed;
                existingRecord.IsForecast = isForecast;
                existingRecord.IngestedAt = DateTime.UtcNow;

                updatedCount++;
            }
            else
            {
                // Insert new record
                var newRecord = new WeatherCache
                {
                    Id = Guid.NewGuid(),
                    ParcelId = parcelId,
                    ForecastDate = forecastDate,
                    IsForecast = isForecast,
                    Et0Mm = et0,
                    PrecipitationMm = precipitation,
                    EffectivePrecipitationMm = effectivePrecipitation,
                    TempMinC = tempMin,
                    TempMaxC = tempMax,
                    RelativeHumidityAvgPct = relativeHumidity,
                    SolarRadiationMj = solarRadiation,
                    WindSpeedMs = windSpeed,
                    IngestedAt = DateTime.UtcNow
                };

                _dbContext.WeatherCaches.Add(newRecord);
                ingestedCount++;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Clear ChangeTracker to prevent memory bloat and performance degradation across parcels
        _dbContext.ChangeTracker.Clear();

        _logger.LogInformation(
            "Parcel '{ParcelName}' ({ParcelId}) weather ingested: {Ingested} added, {Updated} updated.",
            parcelName, parcelId, ingestedCount, updatedCount);

        return (ingestedCount, updatedCount);
    }
}
