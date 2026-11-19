using System.Net;
using AgriTech.Api.Configuration;
using AgriTech.Api.Services;
using Microsoft.Extensions.Http.Resilience;
using Polly;
using Polly.Retry;

namespace AgriTech.Api.Extensions;

/// <summary>
/// Extension methods for configuring Open-Meteo HTTP client and Polly resilience policies.
/// </summary>
public static class WeatherResilienceExtensions
{
    public const string OpenMeteoPipelineName = "open-meteo-pipeline";

    /// <summary>
    /// Registers the typed <see cref="IOpenMeteoClient"/> with Polly resilience policies:
    /// - Handles rate-limiting (HTTP 429 Too Many Requests) and transient HTTP server errors (5xx, 408).
    /// - Applies exponential backoff with randomized jitter to prevent thundering herd.
    /// - Retries up to 3 times before logging a critical error on exhausted network/service failures.
    /// </summary>
    public static IHttpClientBuilder AddOpenMeteoClientWithResilience(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var openMeteoOptions = configuration.GetSection(OpenMeteoOptions.SectionName).Get<OpenMeteoOptions>() 
                               ?? new OpenMeteoOptions();

        services.Configure<OpenMeteoOptions>(configuration.GetSection(OpenMeteoOptions.SectionName));

        var httpClientBuilder = services.AddHttpClient<IOpenMeteoClient, OpenMeteoClient>(client =>
        {
            client.BaseAddress = new Uri(openMeteoOptions.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(openMeteoOptions.TimeoutSeconds);
            client.DefaultRequestHeaders.Add("User-Agent", "AgriTech-WeatherEngine/1.0 (Precision Agriculture Telemetry Ingestion)");
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        });

        httpClientBuilder.AddResilienceHandler(OpenMeteoPipelineName, (pipelineBuilder, context) =>
        {
            var logger = context.ServiceProvider.GetRequiredService<ILogger<OpenMeteoClient>>();

            pipelineBuilder.AddRetry(new HttpRetryStrategyOptions
            {
                MaxRetryAttempts = openMeteoOptions.MaxRetryAttempts,
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                Delay = TimeSpan.FromSeconds(openMeteoOptions.InitialBackoffSeconds),
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutException>()
                    .HandleResult(response =>
                        (int)response.StatusCode == 429 || // HTTP 429 Rate Limiting
                        (int)response.StatusCode >= 500 || // HTTP 5xx Server Errors
                        response.StatusCode == HttpStatusCode.RequestTimeout), // HTTP 408 Timeout
                OnRetry = args =>
                {
                    var statusCode = args.Outcome.Result?.StatusCode;
                    var exceptionMessage = args.Outcome.Exception?.Message;

                    logger.LogWarning(
                        "Open-Meteo external request encountered transient failure (StatusCode: {StatusCode}, Error: {Error}). Executing retry attempt {AttemptNumber} of {MaxRetries} after {RetryDelayMs:F0}ms backoff with jitter.",
                        statusCode.HasValue ? (int)statusCode.Value : "N/A",
                        exceptionMessage ?? "HTTP Error Status",
                        args.AttemptNumber + 1,
                        openMeteoOptions.MaxRetryAttempts,
                        args.RetryDelay.TotalMilliseconds);

                    return ValueTask.CompletedTask;
                }
            });
        });

        return httpClientBuilder;
    }
}
