using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgriTech.Api.Controllers;

/// <summary>
/// RESTful endpoints for meteorological ingestion, parcel forecast caching, and Open-Meteo telemetry sync.
/// Task: BACK-301 / TODO-301
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class WeatherController : ControllerBase
{
    private static readonly SemaphoreSlim BulkIngestionLock = new(1, 1);
    private readonly IWeatherIngestionService _weatherIngestionService;
    private readonly ILogger<WeatherController> _logger;

    public WeatherController(
        IWeatherIngestionService weatherIngestionService,
        ILogger<WeatherController> logger)
    {
        _weatherIngestionService = weatherIngestionService ?? throw new ArgumentNullException(nameof(weatherIngestionService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Manually triggers an immediate weather ingestion pass across all registered parcels in the platform.
    /// Protected by a concurrency throttle to prevent simultaneous duplicate runs and external API quota exhaustion.
    /// Reads PostGIS parcel polygon centroids, calls Open-Meteo /v1/forecast, and upserts entries in weather_cache.
    /// </summary>
    /// <returns>Summary of processed parcels and cached record counts.</returns>
    [HttpPost("ingest")]
    [ProducesResponseType(typeof(WeatherIngestionSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> IngestAllParcels(CancellationToken cancellationToken)
    {
        if (!await BulkIngestionLock.WaitAsync(0, cancellationToken))
        {
            _logger.LogWarning("Bulk weather ingestion requested while another ingestion pass is actively executing. Rejecting with HTTP 429.");
            return StatusCode(StatusCodes.Status429TooManyRequests, new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Ingestion Already In Progress",
                Detail = "A weather ingestion job is currently executing. Please wait for the current run to finish."
            });
        }

        try
        {
            _logger.LogInformation("API request received: Ingest weather for all parcels.");
            var summary = await _weatherIngestionService.IngestDailyForecastForAllParcelsAsync(cancellationToken);
            return Ok(summary);
        }
        finally
        {
            BulkIngestionLock.Release();
        }
    }

    /// <summary>
    /// Manually triggers weather ingestion for a specific single parcel.
    /// </summary>
    /// <param name="parcelId">Unique parcel UUID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Summary of the ingestion result for the parcel.</returns>
    [HttpPost("parcels/{parcelId:guid}/ingest")]
    [ProducesResponseType(typeof(WeatherIngestionSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IngestSingleParcel(Guid parcelId, CancellationToken cancellationToken)
    {
        var parcelExists = await _weatherIngestionService.ParcelExistsAsync(parcelId, cancellationToken);
        if (!parcelExists)
        {
            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Parcel Not Found",
                Detail = $"Parcel with ID '{parcelId}' does not exist."
            });
        }

        _logger.LogInformation("API request received: Ingest weather for parcel {ParcelId}.", parcelId);
        var summary = await _weatherIngestionService.IngestDailyForecastForParcelAsync(parcelId, cancellationToken);

        return Ok(summary);
    }

    /// <summary>
    /// Retrieves cached 7-day rolling meteorological metrics and forecast data for a specified parcel.
    /// </summary>
    /// <param name="parcelId">Unique parcel UUID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>7-day weather metrics including ET0, precipitation, temperature, humidity, and wind speed.</returns>
    [HttpGet("parcels/{parcelId:guid}")]
    [ProducesResponseType(typeof(ParcelWeatherResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetParcelWeather(Guid parcelId, CancellationToken cancellationToken)
    {
        var weather = await _weatherIngestionService.GetParcelWeatherAsync(parcelId, cancellationToken);

        if (weather == null)
        {
            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Parcel Not Found",
                Detail = $"Parcel with ID '{parcelId}' does not exist."
            });
        }

        return Ok(weather);
    }
}
