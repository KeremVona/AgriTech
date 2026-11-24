using System.Text.Json;
using AgriTech.Api.Configuration;
using AgriTech.Api.Controllers;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AgriTech.Api.Tests;

public class PhenologyControllerTests
{
    private sealed class FakeParcelPhenologyQueryService : IParcelPhenologyQueryService
    {
        public Func<Guid, DateOnly, Task<ParcelPhenologyResponseDto?>>? Handler { get; set; }

        public Task<ParcelPhenologyResponseDto?> GetParcelPhenologyAsync(
            Guid parcelId,
            DateOnly targetDate,
            CancellationToken cancellationToken = default)
        {
            if (Handler is null)
            {
                return Task.FromResult<ParcelPhenologyResponseDto?>(null);
            }

            return Handler(parcelId, targetDate);
        }
    }

    private readonly CropPhenologyService _phenologyService;
    private readonly FakeParcelPhenologyQueryService _fakeParcelQuery;
    private readonly PhenologyController _controller;

    public PhenologyControllerTests()
    {
        var options = Options.Create(new CropPhenologyOptions
        {
            ConfigFilePath = Path.Combine("Configuration", "crop_growth_stages.json")
        });
        _phenologyService = new CropPhenologyService(options, NullLogger<CropPhenologyService>.Instance);
        _fakeParcelQuery = new FakeParcelPhenologyQueryService();
        _controller = new PhenologyController(_phenologyService, _fakeParcelQuery);
    }

    [Fact]
    public void GetSupportedCrops_ReturnsOkWithAllFourCrops()
    {
        var result = _controller.GetSupportedCrops();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var crops = Assert.IsAssignableFrom<IReadOnlyList<CropPhenologyCatalogItemDto>>(ok.Value);
        Assert.Equal(4, crops.Count);
    }

    [Fact]
    public void CalculateKc_ValidTomatoMidSeason_ReturnsOkWithProductionJsonContractShape()
    {
        var plantingDate = new DateOnly(2026, 4, 1);
        var targetDate = plantingDate.AddDays(90);

        var result = _controller.CalculateKc("Tomato", plantingDate, targetDate, et0Mm: 4.00m);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<PhenologyAssessmentDto>(ok.Value);

        Assert.Equal("Tomato", dto.CropType);
        Assert.Equal(1.15m, dto.Kc);
        Assert.Equal(PhenologicalStage.MidSeason, dto.Stage);
        Assert.Equal(4.60m, dto.EtcMm);

        // Verify JSON contract rules using the exact production serializer options from Program.cs
        var prodOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        GeoJsonSerializationExtensions.ConfigureGeoJsonOptions(prodOptions);
        var json = JsonSerializer.Serialize(dto, prodOptions);

        Assert.Contains("\"cropType\":\"Tomato\"", json);
        Assert.Contains("\"stage\":\"MID_SEASON\"", json);
        Assert.Contains("\"kc\":1.15", json);
        Assert.Contains("\"etcMm\":4.6", json);
    }

    [Fact]
    public void CalculateKc_InvalidOrOutOfRangeParameters_Returns400ProblemDetailsWithDetail()
    {
        var cases = new[]
        {
            _controller.CalculateKc(cropType: null, plantingDate: new DateOnly(2026, 4, 1)),
            _controller.CalculateKc(cropType: "", plantingDate: new DateOnly(2026, 4, 1)),
            _controller.CalculateKc(cropType: new string('X', 81), plantingDate: new DateOnly(2026, 4, 1)),
            _controller.CalculateKc(cropType: "Tomato", plantingDate: null),
            _controller.CalculateKc(cropType: "Tomato", plantingDate: new DateOnly(2026, 4, 1), et0Mm: -1.0m),
            _controller.CalculateKc(cropType: "Tomato", plantingDate: new DateOnly(2026, 4, 1), et0Mm: 101.0m)
        };

        foreach (var actionResult in cases)
        {
            var obj = Assert.IsType<ObjectResult>(actionResult.Result);
            Assert.Equal(StatusCodes.Status400BadRequest, obj.StatusCode);
            var problem = Assert.IsType<ProblemDetails>(obj.Value);
            Assert.False(string.IsNullOrWhiteSpace(problem.Detail));
        }
    }

    [Fact]
    public void CalculateKc_UnknownCropType_Returns404ProblemDetails()
    {
        var result = _controller.CalculateKc("Banana", new DateOnly(2026, 4, 1));

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status404NotFound, obj.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(obj.Value);
        Assert.Contains("Banana", problem.Detail);
    }

    [Fact]
    public void GetLifecycleCurve_ValidCrop_ReturnsCompleteCurve()
    {
        var result = _controller.GetLifecycleCurve("Corn", new DateOnly(2026, 4, 1));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var curve = Assert.IsAssignableFrom<IReadOnlyList<DailyKcCurvePointDto>>(ok.Value);
        Assert.Equal(126, curve.Count); // Corn: 0..125 inclusive
    }

    [Fact]
    public void GetLifecycleCurve_MissingOrOversizedOrUnknownCrop_ReturnsExpectedProblemDetails()
    {
        var missing = Assert.IsType<ObjectResult>(_controller.GetLifecycleCurve(null).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, missing.StatusCode);

        var oversized = Assert.IsType<ObjectResult>(_controller.GetLifecycleCurve(new string('Z', 81)).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, oversized.StatusCode);

        var unknown = Assert.IsType<ObjectResult>(_controller.GetLifecycleCurve("UnknownCrop", new DateOnly(2026, 4, 1)).Result);
        Assert.Equal(StatusCodes.Status404NotFound, unknown.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetParcelPhenology (GET /api/v1/parcels/{parcelId}/phenology) — All 4 Cases
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetParcelPhenology_WhenParcelDoesNotExist_Returns404ProblemDetails()
    {
        var parcelId = Guid.NewGuid();
        _fakeParcelQuery.Handler = (_, _) => Task.FromResult<ParcelPhenologyResponseDto?>(null);

        var result = await _controller.GetParcelPhenology(parcelId, new DateOnly(2026, 7, 1));

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status404NotFound, obj.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(obj.Value);
        Assert.Contains(parcelId.ToString(), problem.Detail);
    }

    [Fact]
    public async Task GetParcelPhenology_WhenParcelAndWeatherCacheExist_Returns200WithEnrichedEtc()
    {
        var parcelId = Guid.NewGuid();
        var plantingDate = new DateOnly(2026, 4, 1);
        var targetDate = plantingDate.AddDays(90);

        _fakeParcelQuery.Handler = (id, date) =>
        {
            var assessment = _phenologyService.AssessCropPhenology("Tomato", plantingDate, date, et0Mm: 4.50m);
            return Task.FromResult<ParcelPhenologyResponseDto?>(new ParcelPhenologyResponseDto
            {
                ParcelId = id,
                ParcelName = "North Block",
                CalculatedAtUtc = DateTime.UtcNow,
                WeatherSourceDate = date,
                Assessment = assessment
            });
        };

        var result = await _controller.GetParcelPhenology(parcelId, targetDate);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ParcelPhenologyResponseDto>(ok.Value);
        Assert.Equal(parcelId, response.ParcelId);
        Assert.Equal(targetDate, response.WeatherSourceDate);
        Assert.Equal(1.15m, response.Assessment.Kc);
        Assert.Equal(4.50m, response.Assessment.Et0Mm);
        Assert.Equal(5.18m, response.Assessment.EtcMm); // 1.15 * 4.50 = 5.175 -> 5.18
    }

    [Fact]
    public async Task GetParcelPhenology_WhenParcelExistsWithoutWeatherCache_Returns200WithNullEt0AndEtc()
    {
        var parcelId = Guid.NewGuid();
        var plantingDate = new DateOnly(2026, 4, 1);
        var targetDate = plantingDate.AddDays(90);

        _fakeParcelQuery.Handler = (id, date) =>
        {
            var assessment = _phenologyService.AssessCropPhenology("Tomato", plantingDate, date, et0Mm: null);
            return Task.FromResult<ParcelPhenologyResponseDto?>(new ParcelPhenologyResponseDto
            {
                ParcelId = id,
                ParcelName = "Dry Block",
                CalculatedAtUtc = DateTime.UtcNow,
                WeatherSourceDate = null,
                Assessment = assessment
            });
        };

        var result = await _controller.GetParcelPhenology(parcelId, targetDate);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ParcelPhenologyResponseDto>(ok.Value);
        Assert.Null(response.WeatherSourceDate);
        Assert.Null(response.Assessment.Et0Mm);
        Assert.Null(response.Assessment.EtcMm);
        Assert.Equal(1.15m, response.Assessment.Kc);
    }

    [Fact]
    public async Task GetParcelPhenology_WhenParcelCropIsUnsupported_Returns404ProblemDetails()
    {
        var parcelId = Guid.NewGuid();
        _fakeParcelQuery.Handler = (_, _) => throw new KeyNotFoundException("Unsupported crop type 'Soybean'.");

        var result = await _controller.GetParcelPhenology(parcelId, new DateOnly(2026, 7, 1));

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status404NotFound, obj.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(obj.Value);
        Assert.Contains("Soybean", problem.Detail);
    }
}
