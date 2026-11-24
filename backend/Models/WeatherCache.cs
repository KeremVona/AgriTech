namespace AgriTech.Api.Models;

/// <summary>
/// Entity representing cached external Open-Meteo meteorological metrics (observed and 7-day rolling forecasts).
/// Mapped to the 'weather_cache' table (Module 6: Meteorology & FAO-56 Irrigation Engine).
/// </summary>
public class WeatherCache
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Foreign key referencing the associated parcel whose centroid was queried.
    /// </summary>
    public Guid ParcelId { get; set; }

    /// <summary>
    /// Navigation property to the target parcel.
    /// </summary>
    public Parcel Parcel { get; set; } = null!;

    /// <summary>
    /// Target observation or forecast day.
    /// </summary>
    public DateOnly ForecastDate { get; set; }

    /// <summary>
    /// Indicates whether this record is a predictive forecast (true) or historical observation (false).
    /// </summary>
    public bool IsForecast { get; set; } = false;

    /// <summary>
    /// Reference crop evapotranspiration (ET0, mm/day) calculated via FAO-56 Penman-Monteith equation.
    /// </summary>
    public decimal Et0Mm { get; set; }

    /// <summary>
    /// Total ingested daily precipitation (mm).
    /// </summary>
    public decimal PrecipitationMm { get; set; }

    /// <summary>
    /// Effective rainfall depth (mm) adjusted for surface runoff: Peff = max(0, (P - 5) * 0.75).
    /// </summary>
    public decimal EffectivePrecipitationMm { get; set; }

    /// <summary>
    /// Minimum daily ambient temperature (°C).
    /// </summary>
    public decimal TempMinC { get; set; }

    /// <summary>
    /// Maximum daily ambient temperature (°C).
    /// </summary>
    public decimal TempMaxC { get; set; }

    /// <summary>
    /// Average daily relative humidity (%).
    /// </summary>
    public decimal? RelativeHumidityAvgPct { get; set; }

    /// <summary>
    /// Daily shortwave solar radiation sum (MJ/m²).
    /// </summary>
    public decimal? SolarRadiationMj { get; set; }

    /// <summary>
    /// Mean wind speed at 10m height (m/s).
    /// </summary>
    public decimal? WindSpeedMs { get; set; }

    /// <summary>
    /// Timestamp when this record was ingested from Open-Meteo.
    /// </summary>
    public DateTime IngestedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Computes effective rainfall depth (mm) according to the FAO-56 soil water balance equation:
    /// Peff = max(0, (P - 5) * 0.75)
    /// </summary>
    public static decimal CalculateEffectivePrecipitation(decimal precipitationMm)
    {
        if (precipitationMm <= 5.00m)
        {
            return 0.00m;
        }

        return Math.Round((precipitationMm - 5.00m) * 0.75m, 2, MidpointRounding.AwayFromZero);
    }
}
