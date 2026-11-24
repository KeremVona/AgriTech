using AgriTech.Api.Controllers;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Xunit;

namespace AgriTech.Api.Tests;

public class WeatherControllerTests
{
    private class FakeWeatherIngestionService : IWeatherIngestionService
    {
        public bool ShouldFindParcel { get; set; } = true;
        public int IngestAllCalls { get; private set; }
        public int IngestSingleCalls { get; private set; }
        public int GetWeatherCalls { get; private set; }
        public TaskCompletionSource<bool>? HoldIngestAll { get; set; }

        public async Task<WeatherIngestionSummaryDto> IngestDailyForecastForAllParcelsAsync(CancellationToken cancellationToken = default)
        {
            IngestAllCalls++;
            if (HoldIngestAll != null)
            {
                await HoldIngestAll.Task;
            }

            return new WeatherIngestionSummaryDto
            {
                ParcelsProcessed = 3,
                RecordsIngested = 21,
                RecordsUpdated = 0,
                FailedParcels = 0
            };
        }

        public Task<WeatherIngestionSummaryDto> IngestDailyForecastForParcelAsync(Guid parcelId, CancellationToken cancellationToken = default)
        {
            IngestSingleCalls++;
            return Task.FromResult(new WeatherIngestionSummaryDto
            {
                ParcelsProcessed = 1,
                RecordsIngested = 7,
                RecordsUpdated = 0,
                FailedParcels = 0
            });
        }

        public Task<ParcelWeatherResponseDto?> GetParcelWeatherAsync(Guid parcelId, CancellationToken cancellationToken = default)
        {
            GetWeatherCalls++;
            if (!ShouldFindParcel)
            {
                return Task.FromResult<ParcelWeatherResponseDto?>(null);
            }

            return Task.FromResult<ParcelWeatherResponseDto?>(new ParcelWeatherResponseDto
            {
                ParcelId = parcelId,
                ParcelName = "Test Parcel",
                CentroidLatitude = 38.42,
                CentroidLongitude = 27.14,
                Metrics = new List<DailyWeatherMetricDto>()
            });
        }

        public Task<bool> ParcelExistsAsync(Guid parcelId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(ShouldFindParcel);
        }
    }

    private readonly FakeWeatherIngestionService _fakeService;
    private readonly WeatherController _controller;

    public WeatherControllerTests()
    {
        _fakeService = new FakeWeatherIngestionService();
        using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
        var logger = loggerFactory.CreateLogger<WeatherController>();
        _controller = new WeatherController(_fakeService, logger);
    }

    [Fact]
    public async Task IngestAllParcels_ReturnsOk_WithSummary()
    {
        // Act
        var result = await _controller.IngestAllParcels(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<WeatherIngestionSummaryDto>(okResult.Value);
        Assert.Equal(3, summary.ParcelsProcessed);
        Assert.Equal(21, summary.RecordsIngested);
        Assert.Equal(1, _fakeService.IngestAllCalls);
    }

    [Fact]
    public async Task IngestSingleParcel_WhenParcelExists_ReturnsOk()
    {
        // Arrange
        var parcelId = Guid.NewGuid();
        _fakeService.ShouldFindParcel = true;

        // Act
        var result = await _controller.IngestSingleParcel(parcelId, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<WeatherIngestionSummaryDto>(okResult.Value);
        Assert.Equal(1, summary.ParcelsProcessed);
        Assert.Equal(7, summary.RecordsIngested);
    }

    [Fact]
    public async Task IngestSingleParcel_WhenParcelDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var parcelId = Guid.NewGuid();
        _fakeService.ShouldFindParcel = false;

        // Act
        var result = await _controller.IngestSingleParcel(parcelId, CancellationToken.None);

        // Assert
        var notFoundResult = Assert.IsType<NotFoundObjectResult>(result);
        var problem = Assert.IsType<ProblemDetails>(notFoundResult.Value);
        Assert.Equal(StatusCodes.Status404NotFound, problem.Status);
    }

    [Fact]
    public async Task GetParcelWeather_WhenParcelExists_ReturnsOk()
    {
        // Arrange
        var parcelId = Guid.NewGuid();
        _fakeService.ShouldFindParcel = true;

        // Act
        var result = await _controller.GetParcelWeather(parcelId, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var weather = Assert.IsType<ParcelWeatherResponseDto>(okResult.Value);
        Assert.Equal(parcelId, weather.ParcelId);
    }

    [Fact]
    public async Task GetParcelWeather_WhenParcelDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var parcelId = Guid.NewGuid();
        _fakeService.ShouldFindParcel = false;

        // Act
        var result = await _controller.GetParcelWeather(parcelId, CancellationToken.None);

        // Assert
        var notFoundResult = Assert.IsType<NotFoundObjectResult>(result);
        var problem = Assert.IsType<ProblemDetails>(notFoundResult.Value);
        Assert.Equal(StatusCodes.Status404NotFound, problem.Status);
    }

    [Fact]
    public async Task IngestAllParcels_WhenConcurrentCallArrives_Returns429TooManyRequests()
    {
        // Arrange
        var holdTcs = new TaskCompletionSource<bool>();
        _fakeService.HoldIngestAll = holdTcs;

        // Start 1st long-running call
        var firstCallTask = _controller.IngestAllParcels(CancellationToken.None);

        // Act: 2nd concurrent call arrives immediately while 1st is holding lock
        var secondCallResult = await _controller.IngestAllParcels(CancellationToken.None);

        // Assert: 2nd call rejected with 429 Too Many Requests
        var statusResult = Assert.IsType<ObjectResult>(secondCallResult);
        Assert.Equal(StatusCodes.Status429TooManyRequests, statusResult.StatusCode);

        // Release 1st call
        holdTcs.SetResult(true);
        var firstCallResult = await firstCallTask;
        Assert.IsType<OkObjectResult>(firstCallResult);
    }
}
