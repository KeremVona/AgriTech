using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Services;

/// <summary>
/// Service contract for executing meteorological data ingestion and cache management.
/// </summary>
public interface IWeatherIngestionService
{
    /// <summary>
    /// Executes the daily weather ingestion pipeline for all registered parcels in the system.
    /// Reads PostGIS parcel centroids, fetches 7-day rolling forecasts via OpenMeteoClient,
    /// and upserts records in weather_cache without duplicating entries.
    /// </summary>
    Task<WeatherIngestionSummaryDto> IngestDailyForecastForAllParcelsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes the weather ingestion pipeline for a single specified parcel.
    /// </summary>
    Task<WeatherIngestionSummaryDto> IngestDailyForecastForParcelAsync(Guid parcelId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves cached weather metrics and forecast history for a parcel.
    /// </summary>
    Task<ParcelWeatherResponseDto?> GetParcelWeatherAsync(Guid parcelId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks whether a parcel with the specified ID exists in the database.
    /// </summary>
    Task<bool> ParcelExistsAsync(Guid parcelId, CancellationToken cancellationToken = default);
}
