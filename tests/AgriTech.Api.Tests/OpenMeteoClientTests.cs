using System.Net;
using System.Text;
using System.Text.Json;
using AgriTech.Api.Configuration;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace AgriTech.Api.Tests;

public class OpenMeteoClientTests
{
    private class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly Queue<HttpResponseMessage> _responses = new();
        public int CallCount { get; private set; }
        public HttpRequestMessage? LastRequest { get; private set; }

        public void EnqueueResponse(HttpStatusCode statusCode, string content)
        {
            var response = new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(content, Encoding.UTF8, "application/json")
            };
            _responses.Enqueue(response);
        }

        public void EnqueueException(Exception exception)
        {
            // Simulate network fault by throwing
            _responses.Enqueue(null!);
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            LastRequest = request;

            if (_responses.Count == 0)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError));
            }

            var next = _responses.Dequeue();
            if (next == null)
            {
                throw new HttpRequestException("Simulated socket connection failure.");
            }

            return Task.FromResult(next);
        }
    }

    private class TestLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message, Exception? Exception)> Logs { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Logs.Add((logLevel, formatter(state, exception), exception));
        }
    }

    private const string SampleOpenMeteoJson = """
    {
      "latitude": 38.42,
      "longitude": 27.14,
      "generationtime_ms": 0.5,
      "utc_offset_seconds": 0,
      "timezone": "GMT",
      "elevation": 15.0,
      "daily": {
        "time": [
          "2026-11-13",
          "2026-11-14",
          "2026-11-15",
          "2026-11-16",
          "2026-11-17",
          "2026-11-18",
          "2026-11-19"
        ],
        "et0_fao_evapotranspiration": [2.75, 2.39, 1.57, 1.71, 1.62, 2.49, 1.77],
        "precipitation_sum": [1.30, 0.00, 0.40, 0.00, 0.00, 0.00, 0.30],
        "temperature_2m_max": [22.4, 23.1, 21.5, 19.8, 20.7, 21.0, 21.9],
        "temperature_2m_min": [18.2, 18.0, 12.4, 10.9, 11.6, 13.7, 18.9],
        "relative_humidity_2m_mean": [68, 64, 81, 83, 79, 72, 75],
        "shortwave_radiation_sum": [8.10, 9.15, 8.73, 11.00, 9.75, 8.24, 4.62],
        "wind_speed_10m_max": [7.27, 6.63, 2.55, 2.44, 2.53, 9.30, 8.78]
      }
    }
    """;

    [Fact]
    public async Task GetDailyForecastAsync_WithValidCoordinates_Parses7DayMetricsSuccessfully()
    {
        // Arrange
        var mockHandler = new MockHttpMessageHandler();
        mockHandler.EnqueueResponse(HttpStatusCode.OK, SampleOpenMeteoJson);

        var httpClient = new HttpClient(mockHandler)
        {
            BaseAddress = new Uri("https://api.open-meteo.com/")
        };
        var logger = new TestLogger<OpenMeteoClient>();
        var options = Options.Create(new OpenMeteoOptions());
        var client = new OpenMeteoClient(httpClient, logger, options);

        // Act
        var result = await client.GetDailyForecastAsync(38.42, 27.14, forecastDays: 7);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Daily);
        Assert.Equal(7, result.Daily.Time.Count);
        Assert.Equal(2.75m, result.Daily.Et0FaoEvapotranspiration[0]);
        Assert.Equal(1.30m, result.Daily.PrecipitationSum[0]);
        Assert.Equal(22.4m, result.Daily.Temperature2mMax[0]);
        Assert.Equal(18.2m, result.Daily.Temperature2mMin[0]);
        Assert.Equal(68m, result.Daily.RelativeHumidity2mMean![0]);
        Assert.Equal(8.10m, result.Daily.ShortwaveRadiationSum![0]);
        Assert.Equal(7.27m, result.Daily.WindSpeed10mMax![0]);
        Assert.Contains("latitude=38.4200", mockHandler.LastRequest!.RequestUri!.Query);
        Assert.Contains("longitude=27.1400", mockHandler.LastRequest!.RequestUri!.Query);
        Assert.Contains("forecast_days=7", mockHandler.LastRequest!.RequestUri!.Query);
    }

    [Theory]
    [InlineData(-91.0, 0.0)]
    [InlineData(91.0, 0.0)]
    [InlineData(0.0, -181.0)]
    [InlineData(0.0, 181.0)]
    public async Task GetDailyForecastAsync_WithInvalidCoordinates_ThrowsArgumentOutOfRangeException(double lat, double lng)
    {
        // Arrange
        var mockHandler = new MockHttpMessageHandler();
        var httpClient = new HttpClient(mockHandler) { BaseAddress = new Uri("https://api.open-meteo.com/") };
        var logger = new TestLogger<OpenMeteoClient>();
        var client = new OpenMeteoClient(httpClient, logger, Options.Create(new OpenMeteoOptions()));

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => client.GetDailyForecastAsync(lat, lng));
    }

    [Fact]
    public async Task GetDailyForecastAsync_OnApiError_LogsCriticalAndThrows()
    {
        // Arrange
        var mockHandler = new MockHttpMessageHandler();
        mockHandler.EnqueueResponse(HttpStatusCode.InternalServerError, "{\"error\": true, \"reason\": \"Service unavailable\"}");

        var httpClient = new HttpClient(mockHandler) { BaseAddress = new Uri("https://api.open-meteo.com/") };
        var logger = new TestLogger<OpenMeteoClient>();
        var client = new OpenMeteoClient(httpClient, logger, Options.Create(new OpenMeteoOptions()));

        // Act & Assert
        var ex = await Assert.ThrowsAsync<OpenMeteoApiException>(() => client.GetDailyForecastAsync(38.42, 27.14));
        Assert.Equal(500, ex.StatusCode);

        // Verify critical log entry
        Assert.Contains(logger.Logs, l => l.Level == LogLevel.Critical);
    }

    [Fact]
    public async Task OpenMeteoClient_WithPollyResilience_RetriesOnHttp429RateLimit()
    {
        // Arrange - Setup ServiceProvider with AddOpenMeteoClientWithResilience
        var mockHandler = new MockHttpMessageHandler();
        // 1st attempt: 429 Rate limited
        mockHandler.EnqueueResponse((HttpStatusCode)429, "{\"error\": true, \"reason\": \"Daily API rate limit exceeded\"}");
        // 2nd attempt: Success 200 OK
        mockHandler.EnqueueResponse(HttpStatusCode.OK, SampleOpenMeteoJson);

        var inMemoryConfig = new Dictionary<string, string?>
        {
            { "OpenMeteo:BaseUrl", "https://api.open-meteo.com" },
            { "OpenMeteo:MaxRetryAttempts", "3" },
            { "OpenMeteo:InitialBackoffSeconds", "0.05" } // fast test backoff
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(inMemoryConfig).Build();

        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole());
        services.AddSingleton<IConfiguration>(configuration);

        // Register client and override the primary HttpMessageHandler with our mock
        services.AddOpenMeteoClientWithResilience(configuration)
                .ConfigurePrimaryHttpMessageHandler(() => mockHandler);

        var serviceProvider = services.BuildServiceProvider();
        var client = serviceProvider.GetRequiredService<IOpenMeteoClient>();

        // Act
        var result = await client.GetDailyForecastAsync(38.42, 27.14);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, mockHandler.CallCount); // 1 retry after 429
        Assert.Equal(7, result.Daily!.Time.Count);
    }

    [Fact]
    public async Task OpenMeteoClient_WithPollyResilience_RetriesUpTo3TimesBeforeCriticalFailure()
    {
        // Arrange
        var mockHandler = new MockHttpMessageHandler();
        // 4 consecutive 500 errors (1 initial + 3 retries = 4 total calls)
        mockHandler.EnqueueResponse(HttpStatusCode.ServiceUnavailable, "{\"error\": true, \"reason\": \"Down 1\"}");
        mockHandler.EnqueueResponse(HttpStatusCode.ServiceUnavailable, "{\"error\": true, \"reason\": \"Down 2\"}");
        mockHandler.EnqueueResponse(HttpStatusCode.ServiceUnavailable, "{\"error\": true, \"reason\": \"Down 3\"}");
        mockHandler.EnqueueResponse(HttpStatusCode.ServiceUnavailable, "{\"error\": true, \"reason\": \"Down 4\"}");

        var inMemoryConfig = new Dictionary<string, string?>
        {
            { "OpenMeteo:BaseUrl", "https://api.open-meteo.com" },
            { "OpenMeteo:MaxRetryAttempts", "3" },
            { "OpenMeteo:InitialBackoffSeconds", "0.05" }
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(inMemoryConfig).Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);

        services.AddOpenMeteoClientWithResilience(configuration)
                .ConfigurePrimaryHttpMessageHandler(() => mockHandler);

        var serviceProvider = services.BuildServiceProvider();
        var client = serviceProvider.GetRequiredService<IOpenMeteoClient>();

        // Act & Assert
        await Assert.ThrowsAsync<OpenMeteoApiException>(() => client.GetDailyForecastAsync(38.42, 27.14));

        // 1 initial call + 3 retries = 4 calls total
        Assert.Equal(4, mockHandler.CallCount);
    }
}
