namespace AgriTech.Api.Configuration;

/// <summary>
/// Configuration settings for the scheduled daily weather ingestion background job.
/// </summary>
public class WeatherIngestionOptions
{
    public const string SectionName = "WeatherIngestion";

    /// <summary>
    /// Whether the background ingestion service is enabled. Default is true.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Interval in hours between background ingestion runs. Default is 24 hours (daily).
    /// </summary>
    public int IntervalHours { get; set; } = 24;

    /// <summary>
    /// Initial delay in seconds before the first scheduled run starts after application startup.
    /// </summary>
    public int InitialDelaySeconds { get; set; } = 10;

    /// <summary>
    /// Whether to trigger an immediate ingestion pass upon application startup.
    /// </summary>
    public bool RunAtStartup { get; set; } = false;
}
