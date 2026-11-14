namespace AgriTech.Api.Configuration;

/// <summary>
/// Configuration settings for connecting to the Open-Meteo external weather API.
/// </summary>
public class OpenMeteoOptions
{
    public const string SectionName = "OpenMeteo";

    /// <summary>
    /// Base URL for the Open-Meteo API. Default is "https://api.open-meteo.com".
    /// </summary>
    public string BaseUrl { get; set; } = "https://api.open-meteo.com";

    /// <summary>
    /// HTTP request timeout in seconds. Default is 15 seconds.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>
    /// Maximum retry attempts for transient errors and HTTP 429 rate limiting. Default is 3.
    /// </summary>
    public int MaxRetryAttempts { get; set; } = 3;

    /// <summary>
    /// Initial exponential backoff delay in seconds. Default is 1.0 second.
    /// </summary>
    public double InitialBackoffSeconds { get; set; } = 1.0;
}
