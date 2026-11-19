using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using AgriTech.Api.Configuration;
using AgriTech.Api.Models.DTOs;
using Microsoft.Extensions.Options;

namespace AgriTech.Api.Services;

/// <summary>
/// Custom exception thrown when calls to the Open-Meteo external service fail.
/// </summary>
public class OpenMeteoApiException : Exception
{
    public int? StatusCode { get; }

    public OpenMeteoApiException(string message, int? statusCode = null, Exception? innerException = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
    }
}

/// <summary>
/// Typed HTTP client implementation for consuming the Open-Meteo /v1/forecast meteorological API.
/// Protected by Polly resilience policies handling rate-limiting (429) and network retries with exponential jitter.
/// </summary>
public class OpenMeteoClient : IOpenMeteoClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenMeteoClient> _logger;
    private readonly OpenMeteoOptions _options;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public OpenMeteoClient(
        HttpClient httpClient,
        ILogger<OpenMeteoClient> logger,
        IOptions<OpenMeteoOptions> options)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? new OpenMeteoOptions();
    }

    /// <inheritdoc />
    public async Task<OpenMeteoForecastResponse> GetDailyForecastAsync(
        double latitude,
        double longitude,
        int forecastDays = 7,
        int pastDays = 0,
        CancellationToken cancellationToken = default)
    {
        if (latitude < -90.0 || latitude > 90.0)
        {
            throw new ArgumentOutOfRangeException(nameof(latitude), "Latitude must be between -90 and 90 degrees.");
        }

        if (longitude < -180.0 || longitude > 180.0)
        {
            throw new ArgumentOutOfRangeException(nameof(longitude), "Longitude must be between -180 and 180 degrees.");
        }

        if (forecastDays < 1 || forecastDays > 16)
        {
            throw new ArgumentOutOfRangeException(nameof(forecastDays), "Forecast days must be between 1 and 16.");
        }

        if (pastDays < 0 || pastDays > 92)
        {
            throw new ArgumentOutOfRangeException(nameof(pastDays), "Past days must be between 0 and 92.");
        }

        var latStr = latitude.ToString("F4", CultureInfo.InvariantCulture);
        var lngStr = longitude.ToString("F4", CultureInfo.InvariantCulture);

        // Required meteorological parameters:
        // - et0_fao_evapotranspiration: FAO-56 Penman-Monteith reference evapotranspiration (mm/day)
        // - precipitation_sum: Daily aggregated precipitation (mm)
        // - temperature_2m_max, temperature_2m_min: Daily max & min ambient temperatures (°C)
        // Additional high-resolution parameters: relative_humidity_2m_mean, shortwave_radiation_sum, wind_speed_10m_max
        var requestUri = $"v1/forecast?latitude={latStr}&longitude={lngStr}" +
                         $"&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,shortwave_radiation_sum,wind_speed_10m_max" +
                         $"&wind_speed_unit=ms&forecast_days={forecastDays}&timezone=UTC";

        if (pastDays > 0)
        {
            requestUri += $"&past_days={pastDays}";
        }

        _logger.LogInformation(
            "Querying Open-Meteo forecast for coordinates ({Latitude}, {Longitude}) across {ForecastDays} days...",
            latStr, lngStr, forecastDays);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.GetAsync(requestUri, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogCritical(
                ex,
                "Open-Meteo API network failure: retries exhausted after {MaxRetries} attempts for coordinates ({Latitude}, {Longitude})",
                _options.MaxRetryAttempts, latStr, lngStr);
            throw new OpenMeteoApiException($"Network failure connecting to Open-Meteo after {_options.MaxRetryAttempts} retries.", innerException: ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogCritical(
                ex,
                "Open-Meteo API timeout failure: retries exhausted after {MaxRetries} attempts for coordinates ({Latitude}, {Longitude})",
                _options.MaxRetryAttempts, latStr, lngStr);
            throw new OpenMeteoApiException($"Request to Open-Meteo timed out after {_options.MaxRetryAttempts} retries.", innerException: ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var statusCode = (int)response.StatusCode;
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);

            _logger.LogCritical(
                "Open-Meteo API returned non-success status code {StatusCode} after retries exhausted for ({Latitude}, {Longitude}). Body: {ErrorBody}",
                statusCode, latStr, lngStr, errorBody);

            throw new OpenMeteoApiException(
                $"Open-Meteo API call failed with status code {statusCode}: {errorBody}",
                statusCode);
        }

        OpenMeteoForecastResponse? forecast;
        try
        {
            forecast = await response.Content.ReadFromJsonAsync<OpenMeteoForecastResponse>(JsonOptions, cancellationToken);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to deserialize Open-Meteo response for ({Latitude}, {Longitude})", latStr, lngStr);
            throw new OpenMeteoApiException("Failed to deserialize Open-Meteo JSON response.", innerException: ex);
        }

        if (forecast?.Daily == null || forecast.Daily.Time.Count == 0)
        {
            _logger.LogWarning("Open-Meteo returned empty daily data array for ({Latitude}, {Longitude})", latStr, lngStr);
            throw new OpenMeteoApiException("Open-Meteo returned an empty daily forecast dataset.");
        }

        _logger.LogInformation(
            "Successfully fetched {DaysCount} days of meteorological forecast data for ({Latitude}, {Longitude}) from Open-Meteo.",
            forecast.Daily.Time.Count, latStr, lngStr);

        return forecast;
    }
}
