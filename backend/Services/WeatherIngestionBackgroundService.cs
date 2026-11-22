using AgriTech.Api.Configuration;
using Microsoft.Extensions.Options;

namespace AgriTech.Api.Services;

/// <summary>
/// Scheduled background service running daily via IHostedService to fetch 7-day rolling meteorological metrics
/// from Open-Meteo for all parcel centroids and write entries into weather_cache.
/// </summary>
public class WeatherIngestionBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WeatherIngestionBackgroundService> _logger;
    private readonly WeatherIngestionOptions _options;

    public WeatherIngestionBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<WeatherIngestionBackgroundService> logger,
        IOptions<WeatherIngestionOptions> options)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? new WeatherIngestionOptions();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("WeatherIngestionBackgroundService is disabled in configuration.");
            return;
        }

        _logger.LogInformation(
            "WeatherIngestionBackgroundService scheduled to run every {IntervalHours} hours (Initial delay: {InitialDelaySeconds}s, RunAtStartup: {RunAtStartup}).",
            _options.IntervalHours, _options.InitialDelaySeconds, _options.RunAtStartup);

        // Initial delay to allow web application start-up and database migrations to complete
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(_options.InitialDelaySeconds), stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        if (_options.RunAtStartup)
        {
            await ExecuteIngestionPassAsync(stoppingToken);
        }

        var interval = TimeSpan.FromHours(Math.Max(1, _options.IntervalHours));
        using var timer = new PeriodicTimer(interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (await timer.WaitForNextTickAsync(stoppingToken))
                {
                    await ExecuteIngestionPassAsync(stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in scheduled weather ingestion timer loop.");
            }
        }

        _logger.LogInformation("WeatherIngestionBackgroundService has stopped.");
    }

    private async Task ExecuteIngestionPassAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Triggering scheduled daily meteorological ingestion pass...");

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var ingestionService = scope.ServiceProvider.GetRequiredService<IWeatherIngestionService>();

            var summary = await ingestionService.IngestDailyForecastForAllParcelsAsync(cancellationToken);

            _logger.LogInformation(
                "Scheduled meteorological ingestion finished successfully in {DurationMs}ms. Parcels: {Parcels}, Ingested: {Ingested}, Updated: {Updated}, Failed: {Failed}",
                summary.ExecutionDurationMs, summary.ParcelsProcessed, summary.RecordsIngested, summary.RecordsUpdated, summary.FailedParcels);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Scheduled meteorological ingestion pass was canceled.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scheduled meteorological ingestion pass encountered a critical failure.");
        }
    }
}
