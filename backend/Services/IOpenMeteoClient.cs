using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Services;

/// <summary>
/// Typed HTTP client contract for consuming Open-Meteo meteorological endpoints.
/// </summary>
public interface IOpenMeteoClient
{
    /// <summary>
    /// Fetches rolling meteorological forecast data (including ET0, precipitation, temp min/max, humidity, radiation, wind)
    /// from Open-Meteo for the specified geographic coordinates.
    /// </summary>
    /// <param name="latitude">Geographic latitude in decimal degrees (-90 to 90).</param>
    /// <param name="longitude">Geographic longitude in decimal degrees (-180 to 180).</param>
    /// <param name="forecastDays">Number of forecast days to pull (default 7).</param>
    /// <param name="pastDays">Number of preceding observation days to pull (default 0; set 1 for trailing 24h observed metrics).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Deserialized Open-Meteo forecast payload.</returns>
    Task<OpenMeteoForecastResponse> GetDailyForecastAsync(
        double latitude,
        double longitude,
        int forecastDays = 7,
        int pastDays = 0,
        CancellationToken cancellationToken = default);
}
