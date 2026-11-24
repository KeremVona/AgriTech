using System.Text.Json.Serialization;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// Unit definitions returned by the Open-Meteo /v1/forecast API.
/// </summary>
public class OpenMeteoDailyUnitsDto
{
    [JsonPropertyName("time")]
    public string? Time { get; set; }

    [JsonPropertyName("et0_fao_evapotranspiration")]
    public string? Et0FaoEvapotranspiration { get; set; }

    [JsonPropertyName("precipitation_sum")]
    public string? PrecipitationSum { get; set; }

    [JsonPropertyName("temperature_2m_max")]
    public string? Temperature2mMax { get; set; }

    [JsonPropertyName("temperature_2m_min")]
    public string? Temperature2mMin { get; set; }

    [JsonPropertyName("relative_humidity_2m_mean")]
    public string? RelativeHumidity2mMean { get; set; }

    [JsonPropertyName("shortwave_radiation_sum")]
    public string? ShortwaveRadiationSum { get; set; }

    [JsonPropertyName("wind_speed_10m_max")]
    public string? WindSpeed10mMax { get; set; }
}

/// <summary>
/// Daily aggregated time-series meteorological arrays from Open-Meteo /v1/forecast.
/// </summary>
public class OpenMeteoDailyDataDto
{
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = new();

    [JsonPropertyName("et0_fao_evapotranspiration")]
    public List<decimal> Et0FaoEvapotranspiration { get; set; } = new();

    [JsonPropertyName("precipitation_sum")]
    public List<decimal> PrecipitationSum { get; set; } = new();

    [JsonPropertyName("temperature_2m_max")]
    public List<decimal> Temperature2mMax { get; set; } = new();

    [JsonPropertyName("temperature_2m_min")]
    public List<decimal> Temperature2mMin { get; set; } = new();

    [JsonPropertyName("relative_humidity_2m_mean")]
    public List<decimal?>? RelativeHumidity2mMean { get; set; }

    [JsonPropertyName("shortwave_radiation_sum")]
    public List<decimal?>? ShortwaveRadiationSum { get; set; }

    [JsonPropertyName("wind_speed_10m_max")]
    public List<decimal?>? WindSpeed10mMax { get; set; }
}

/// <summary>
/// Root response object returned by Open-Meteo API /v1/forecast.
/// </summary>
public class OpenMeteoForecastResponse
{
    [JsonPropertyName("latitude")]
    public double Latitude { get; set; }

    [JsonPropertyName("longitude")]
    public double Longitude { get; set; }

    [JsonPropertyName("generationtime_ms")]
    public double GenerationTimeMs { get; set; }

    [JsonPropertyName("utc_offset_seconds")]
    public int UtcOffsetSeconds { get; set; }

    [JsonPropertyName("timezone")]
    public string? Timezone { get; set; }

    [JsonPropertyName("timezone_abbreviation")]
    public string? TimezoneAbbreviation { get; set; }

    [JsonPropertyName("elevation")]
    public double Elevation { get; set; }

    [JsonPropertyName("daily_units")]
    public OpenMeteoDailyUnitsDto? DailyUnits { get; set; }

    [JsonPropertyName("daily")]
    public OpenMeteoDailyDataDto? Daily { get; set; }
}

/// <summary>
/// DTO representing a single day's meteorological and FAO-56 metrics for API consumers.
/// </summary>
public class DailyWeatherMetricDto
{
    public Guid Id { get; set; }
    public DateOnly ForecastDate { get; set; }
    public bool IsForecast { get; set; }
    public decimal Et0Mm { get; set; }
    public decimal PrecipitationMm { get; set; }
    public decimal EffectivePrecipitationMm { get; set; }
    public decimal TempMinC { get; set; }
    public decimal TempMaxC { get; set; }
    public decimal? RelativeHumidityAvgPct { get; set; }
    public decimal? SolarRadiationMj { get; set; }
    public decimal? WindSpeedMs { get; set; }
    public DateTime IngestedAt { get; set; }
}

/// <summary>
/// DTO response providing full 7-day weather forecast and centroid metadata for a specific parcel.
/// </summary>
public class ParcelWeatherResponseDto
{
    public Guid ParcelId { get; set; }
    public string ParcelName { get; set; } = string.Empty;
    public double CentroidLatitude { get; set; }
    public double CentroidLongitude { get; set; }
    public List<DailyWeatherMetricDto> Metrics { get; set; } = new();
}

/// <summary>
/// Execution summary of the daily Open-Meteo weather ingestion pipeline.
/// </summary>
public class WeatherIngestionSummaryDto
{
    public DateTime ExecutedAtUtc { get; set; } = DateTime.UtcNow;
    public int ParcelsProcessed { get; set; }
    public int RecordsIngested { get; set; }
    public int RecordsUpdated { get; set; }
    public int FailedParcels { get; set; }
    public List<string> Errors { get; set; } = new();
    public long ExecutionDurationMs { get; set; }
}
