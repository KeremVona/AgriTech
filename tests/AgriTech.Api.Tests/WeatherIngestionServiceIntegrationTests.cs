using AgriTech.Api.Data;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using Xunit;

namespace AgriTech.Api.Tests;

public class WeatherIngestionServiceIntegrationTests : IAsyncLifetime
{
    private readonly AgriTechDbContext _dbContext;
    private readonly ILogger<WeatherIngestionService> _logger;
    private Guid _testFieldId;
    private Guid _testParcelId;
    private readonly Guid _ownerId = Guid.Parse("a0000000-0000-0000-0000-000000000001");
    private readonly Guid _cropId = Guid.Parse("c0000000-0000-0000-0000-000000000001");

    public WeatherIngestionServiceIntegrationTests()
    {
        var options = new DbContextOptionsBuilder<AgriTechDbContext>()
            .UseNpgsql(
                "Host=localhost;Port=5432;Database=agritech_db;Username=postgres;Password=postgres",
                npgsqlOptions => npgsqlOptions.UseNetTopologySuite())
            .Options;

        _dbContext = new AgriTechDbContext(options);
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<WeatherIngestionService>();
    }

    public async Task InitializeAsync()
    {
        // Setup isolated test field and parcel
        _testFieldId = Guid.NewGuid();
        _testParcelId = Guid.NewGuid();

        var geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
        // Field polygon around Izmir coordinates (lat: 38.42, lng: 27.14)
        var fieldCoords = new[]
        {
            new Coordinate(27.130, 38.410),
            new Coordinate(27.150, 38.410),
            new Coordinate(27.150, 38.430),
            new Coordinate(27.130, 38.430),
            new Coordinate(27.130, 38.410)
        };
        var fieldPolygon = geometryFactory.CreatePolygon(fieldCoords);

        var testField = new Field
        {
            Id = _testFieldId,
            OwnerId = _ownerId,
            Name = "Integration Test Field",
            BoundaryGeom = fieldPolygon,
            TotalAreaHectares = 10.0m,
            LocationName = "Izmir Test Hub"
        };
        _dbContext.Fields.Add(testField);

        // Parcel polygon inside the field
        var parcelCoords = new[]
        {
            new Coordinate(27.135, 38.415),
            new Coordinate(27.145, 38.415),
            new Coordinate(27.145, 38.425),
            new Coordinate(27.135, 38.425),
            new Coordinate(27.135, 38.415)
        };
        var parcelPolygon = geometryFactory.CreatePolygon(parcelCoords);

        var testParcel = new Parcel
        {
            Id = _testParcelId,
            FieldId = _testFieldId,
            CropId = _cropId,
            SoilProfileId = "sandy_loam",
            Name = "Integration Test Parcel",
            BoundaryGeom = parcelPolygon,
            AreaHectares = 2.5m,
            PlantingDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30))
        };
        _dbContext.Parcels.Add(testParcel);

        await _dbContext.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        // Cleanup test data
        try
        {
            var parcel = await _dbContext.Parcels.FindAsync(_testParcelId);
            if (parcel != null)
            {
                _dbContext.Parcels.Remove(parcel);
            }

            var field = await _dbContext.Fields.FindAsync(_testFieldId);
            if (field != null)
            {
                _dbContext.Fields.Remove(field);
            }

            await _dbContext.SaveChangesAsync();
        }
        catch
        {
            // Ignore cleanup errors
        }
        await _dbContext.DisposeAsync();
    }

    private class MockWeatherClient : IOpenMeteoClient
    {
        public int CallCount { get; private set; }

        public Task<OpenMeteoForecastResponse> GetDailyForecastAsync(
            double latitude,
            double longitude,
            int forecastDays = 7,
            int pastDays = 0,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var dates = Enumerable.Range(0, 7)
                .Select(i => today.AddDays(i).ToString("yyyy-MM-dd"))
                .ToList();

            var response = new OpenMeteoForecastResponse
            {
                Latitude = latitude,
                Longitude = longitude,
                Daily = new OpenMeteoDailyDataDto
                {
                    Time = dates,
                    Et0FaoEvapotranspiration = new List<decimal> { 2.5m, 2.7m, 3.0m, 2.8m, 3.1m, 3.2m, 2.9m },
                    PrecipitationSum = new List<decimal> { 12.0m, 0.0m, 0.0m, 4.0m, 8.0m, 0.0m, 0.0m },
                    Temperature2mMax = new List<decimal> { 24.0m, 25.0m, 26.0m, 23.0m, 22.0m, 25.0m, 27.0m },
                    Temperature2mMin = new List<decimal> { 14.0m, 15.0m, 16.0m, 13.0m, 12.0m, 14.0m, 15.0m },
                    RelativeHumidity2mMean = new List<decimal?> { 65m, 60m, 58m, 70m, 75m, 62m, 59m },
                    ShortwaveRadiationSum = new List<decimal?> { 18.5m, 19.0m, 20.1m, 15.2m, 14.0m, 18.0m, 21.0m },
                    WindSpeed10mMax = new List<decimal?> { 3.5m, 4.0m, 2.8m, 5.2m, 6.0m, 3.1m, 2.5m }
                }
            };

            return Task.FromResult(response);
        }
    }

    [Fact]
    public async Task IngestionService_IngestsAndUpdatesWithoutDuplicateRecords()
    {
        // Arrange
        var mockClient = new MockWeatherClient();
        var service = new WeatherIngestionService(_dbContext, mockClient, _logger);

        // Act 1: First ingestion pass (Fresh insert of 7 forecast days)
        var pass1 = await service.IngestDailyForecastForParcelAsync(_testParcelId);

        // Assert 1
        Assert.Equal(1, pass1.ParcelsProcessed);
        Assert.Equal(7, pass1.RecordsIngested);
        Assert.Equal(0, pass1.RecordsUpdated);
        Assert.Equal(0, pass1.FailedParcels);

        var cachedRows1 = await _dbContext.WeatherCaches
            .Where(w => w.ParcelId == _testParcelId)
            .OrderBy(w => w.ForecastDate)
            .ToListAsync();

        Assert.Equal(7, cachedRows1.Count);
        // Check effective precipitation on first day (12.0mm -> (12 - 5) * 0.75 = 5.25mm)
        Assert.Equal(5.25m, cachedRows1[0].EffectivePrecipitationMm);
        // Check effective precipitation on 4th day (4.0mm -> <= 5mm -> 0.00mm)
        Assert.Equal(0.00m, cachedRows1[3].EffectivePrecipitationMm);

        // Act 2: Second ingestion pass (Idempotency & deduplication check)
        var pass2 = await service.IngestDailyForecastForParcelAsync(_testParcelId);

        // Assert 2: All 7 records should be updated in-place, NOT duplicated!
        Assert.Equal(1, pass2.ParcelsProcessed);
        Assert.Equal(0, pass2.RecordsIngested);
        Assert.Equal(7, pass2.RecordsUpdated);
        Assert.Equal(0, pass2.FailedParcels);

        var cachedRows2 = await _dbContext.WeatherCaches
            .Where(w => w.ParcelId == _testParcelId)
            .ToListAsync();

        // Exactly 7 records must remain in database (Acceptance Criteria 1: Zero duplicates)
        Assert.Equal(7, cachedRows2.Count);
    }

    [Fact]
    public async Task GetParcelWeatherAsync_ReturnsEnriched7DayMetricsWithCentroid()
    {
        // Arrange
        var mockClient = new MockWeatherClient();
        var service = new WeatherIngestionService(_dbContext, mockClient, _logger);
        await service.IngestDailyForecastForParcelAsync(_testParcelId);

        // Act
        var result = await service.GetParcelWeatherAsync(_testParcelId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(_testParcelId, result.ParcelId);
        Assert.Equal("Integration Test Parcel", result.ParcelName);
        Assert.True(result.CentroidLatitude > 38.41 && result.CentroidLatitude < 38.43);
        Assert.True(result.CentroidLongitude > 27.13 && result.CentroidLongitude < 27.15);
        Assert.Equal(7, result.Metrics.Count);
    }
}
