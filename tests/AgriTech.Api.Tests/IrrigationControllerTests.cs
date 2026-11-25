using System.Text.Json;
using AgriTech.Api.Configuration;
using AgriTech.Api.Controllers;
using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AgriTech.Api.Tests;

public class IrrigationControllerTests
{
    private sealed class FakeIrrigationSchedulingEngine : IIrrigationSchedulingEngine
    {
        private readonly IrrigationSchedulingEngine _realMathEngine;

        public Func<Guid, DateOnly?, Task<WaterBudgetDto?>>? WaterBudgetHandler { get; set; }
        public Func<Guid, int, Task<IReadOnlyList<IrrigationEventDto>?>>? EventsHandler { get; set; }
        public Func<Guid, ParcelIrrigationEvaluationRequestDto?, Task<ParcelIrrigationEvaluationResponseDto?>>? ParcelEvalHandler { get; set; }
        public Func<string, Task<SoilProfile?>>? SoilProfileHandler { get; set; }

        public FakeIrrigationSchedulingEngine()
        {
            var db = new AgriTechDbContext(new DbContextOptionsBuilder<AgriTechDbContext>().Options);
            var phenology = new CropPhenologyService(
                Options.Create(new CropPhenologyOptions { ConfigFilePath = Path.Combine("Configuration", "crop_growth_stages.json") }),
                NullLogger<CropPhenologyService>.Instance);
            _realMathEngine = new IrrigationSchedulingEngine(db, phenology, NullLogger<IrrigationSchedulingEngine>.Instance);
        }

        public SoilHydraulicCapacityDto CalculateHydraulicCapacity(SoilProfile soilProfile, decimal effectiveRootDepthM, decimal? madFractionOverride = null) =>
            _realMathEngine.CalculateHydraulicCapacity(soilProfile, effectiveRootDepthM, madFractionOverride);

        public DailyWaterBalanceResultDto ComputeDailyWaterBalance(
            SoilProfile soilProfile, decimal previousDepletionMm, decimal etcMm, decimal precipitationMm,
            decimal irrigationMm, decimal effectiveRootDepthM, decimal areaHectares,
            decimal irrigationEfficiency, decimal systemFlowRateLpm, decimal? madFractionOverride = null) =>
            _realMathEngine.ComputeDailyWaterBalance(
                soilProfile, previousDepletionMm, etcMm, precipitationMm, irrigationMm,
                effectiveRootDepthM, areaHectares, irrigationEfficiency, systemFlowRateLpm, madFractionOverride);

        public IrrigationRefillPlanDto CalculateRefillPlan(
            decimal deficitDepthMm, decimal areaHectares, decimal irrigationEfficiency,
            decimal systemFlowRateLpm, decimal fieldCapacityFraction, decimal effectiveRootDepthM) =>
            _realMathEngine.CalculateRefillPlan(deficitDepthMm, areaHectares, irrigationEfficiency, systemFlowRateLpm, fieldCapacityFraction, effectiveRootDepthM);

        public decimal ComputeDepletionFromMoisturePct(SoilProfile soilProfile, decimal soilMoisturePct, decimal effectiveRootDepthM) =>
            _realMathEngine.ComputeDepletionFromMoisturePct(soilProfile, soilMoisturePct, effectiveRootDepthM);

        public decimal? EstimateHoursUntilTrigger(decimal currentDepletionMm, decimal rawMm, decimal dailyEtcMm, decimal dailyEffectivePrecipMm) =>
            _realMathEngine.EstimateHoursUntilTrigger(currentDepletionMm, rawMm, dailyEtcMm, dailyEffectivePrecipMm);

        public Task<SoilProfile?> GetSoilProfileAsync(string soilProfileId, CancellationToken cancellationToken = default) =>
            SoilProfileHandler is not null ? SoilProfileHandler(soilProfileId) : Task.FromResult<SoilProfile?>(null);

        public Task<ParcelIrrigationEvaluationResponseDto?> EvaluateAndScheduleParcelAsync(
            Guid parcelId, ParcelIrrigationEvaluationRequestDto? request = null, CancellationToken cancellationToken = default) =>
            ParcelEvalHandler is not null ? ParcelEvalHandler(parcelId, request) : Task.FromResult<ParcelIrrigationEvaluationResponseDto?>(null);

        public Task<WaterBudgetDto?> GetParcelWaterBudgetAsync(
            Guid parcelId, DateOnly? targetDate = null, CancellationToken cancellationToken = default) =>
            WaterBudgetHandler is not null ? WaterBudgetHandler(parcelId, targetDate) : Task.FromResult<WaterBudgetDto?>(null);

        public Task<IReadOnlyList<IrrigationEventDto>?> GetParcelIrrigationEventsAsync(
            Guid parcelId, int limit = 50, CancellationToken cancellationToken = default) =>
            EventsHandler is not null ? EventsHandler(parcelId, limit) : Task.FromResult<IReadOnlyList<IrrigationEventDto>?>(null);
    }

    private readonly FakeIrrigationSchedulingEngine _fakeEngine;
    private readonly IrrigationController _controller;

    private static readonly SoilProfile SandyLoam = new()
    {
        Id = "sandy_loam",
        Name = "Sandy Loam",
        FieldCapacityPct = 0.220m,
        WiltingPointPct = 0.100m,
        SaturationPct = 0.430m,
        HydraulicConductivity = 25.00m,
        MadThresholdPct = 0.50m
    };

    public IrrigationControllerTests()
    {
        _fakeEngine = new FakeIrrigationSchedulingEngine();
        _controller = new IrrigationController(_fakeEngine);
    }

    [Fact]
    public async Task GetParcelWaterBudget_Returns200WithExactIrrigationApiContractShape()
    {
        var parcelId = Guid.NewGuid();
        _fakeEngine.WaterBudgetHandler = (id, _) => Task.FromResult<WaterBudgetDto?>(new WaterBudgetDto
        {
            ParcelId = id,
            ParcelName = "North Block",
            CropName = "Tomato",
            SoilProfileId = "sandy_loam",
            SoilProfileName = "Sandy Loam",
            FieldCapacityPct = 22.0m,
            WiltingPointPct = 10.0m,
            SaturationPct = 43.0m,
            MadFraction = 0.50m,
            CurrentMoisturePct = 18.4m,
            LatestReadingAt = new DateTime(2026, 11, 24, 12, 0, 0, DateTimeKind.Utc),
            HoursUntilTrigger = 24.5m,
            SystemFlowRateLpm = 100.0m
        });

        var result = await _controller.GetParcelWaterBudget(parcelId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<WaterBudgetDto>(ok.Value);
        Assert.Equal(22.0m, dto.FieldCapacityPct);
        Assert.Equal(0.50m, dto.MadFraction);

        // Verify exact camelCase + ISO-8601 UTC serialization under production ConfigureGeoJsonOptions
        var prodOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        GeoJsonSerializationExtensions.ConfigureGeoJsonOptions(prodOptions);
        var json = JsonSerializer.Serialize(dto, prodOptions);

        Assert.Contains("\"parcelName\":\"North Block\"", json);
        Assert.Contains("\"fieldCapacityPct\":22.0", json);
        Assert.Contains("\"madFraction\":0.50", json);
        Assert.Contains("\"latestReadingAt\":\"2026-11-24T12:00:00Z\"", json);
        Assert.Contains("\"systemFlowRateLpm\":100.0", json);
    }

    [Fact]
    public async Task GetParcelWaterBudget_WhenParcelMissing_Returns404ProblemDetails()
    {
        var result = await _controller.GetParcelWaterBudget(Guid.NewGuid());

        var obj = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status404NotFound, obj.StatusCode);
        Assert.IsType<ProblemDetails>(obj.Value);
    }

    [Fact]
    public async Task GetParcelIrrigationEvents_Returns200WithUppercaseContractEnums()
    {
        var parcelId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        int? capturedLimit = null;
        _fakeEngine.EventsHandler = (_, limit) =>
        {
            capturedLimit = limit;
            return Task.FromResult<IReadOnlyList<IrrigationEventDto>?>(new[]
            {
                new IrrigationEventDto
                {
                    Id = eventId,
                    TriggerType = IrrigationTriggerType.AutomatedDeficit,
                    Status = IrrigationEventStatus.Pending,
                    ScheduledStart = new DateTime(2026, 11, 24, 15, 0, 0, DateTimeKind.Utc),
                    DurationMinutes = 45,
                    WaterVolumeLiters = 4500.00m
                }
            });
        };

        var result = await _controller.GetParcelIrrigationEvents(parcelId, limit: 25);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var events = Assert.IsAssignableFrom<IReadOnlyList<IrrigationEventDto>>(ok.Value);
        Assert.Equal(25, capturedLimit);
        Assert.Single(events);

        var prodOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        GeoJsonSerializationExtensions.ConfigureGeoJsonOptions(prodOptions);
        var json = JsonSerializer.Serialize(events[0], prodOptions);

        Assert.Contains("\"triggerType\":\"AUTOMATED_DEFICIT\"", json);
        Assert.Contains("\"status\":\"PENDING\"", json);
        Assert.Contains("\"scheduledStart\":\"2026-11-24T15:00:00Z\"", json);
    }

    [Fact]
    public async Task GetParcelIrrigationEvents_WhenParcelMissingOrLimitInvalid_Returns404And400()
    {
        var invalidLow = Assert.IsType<ObjectResult>((await _controller.GetParcelIrrigationEvents(Guid.NewGuid(), limit: 0)).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, invalidLow.StatusCode);

        var invalidHigh = Assert.IsType<ObjectResult>((await _controller.GetParcelIrrigationEvents(Guid.NewGuid(), limit: 501)).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, invalidHigh.StatusCode);

        var notFound = Assert.IsType<ObjectResult>((await _controller.GetParcelIrrigationEvents(Guid.NewGuid())).Result);
        Assert.Equal(StatusCodes.Status404NotFound, notFound.StatusCode);
    }

    [Fact]
    public async Task EvaluateWaterBalance_ValidSoilProfile_ComputesBalanceAndTrigger()
    {
        _fakeEngine.SoilProfileHandler = id => Task.FromResult<SoilProfile?>(id == "sandy_loam" ? SandyLoam : null);

        var request = new DailyWaterBalanceRequestDto
        {
            SoilProfileId = "sandy_loam",
            PreviousDepletionMm = 32.00m,
            EtcMm = 5.00m,
            PrecipitationMm = 0.00m,
            IrrigationMm = 0.00m,
            EffectiveRootDepthM = 0.60m,
            AreaHectares = 1.00m,
            IrrigationEfficiency = 0.88m,
            SystemFlowRateLpm = 500.00m
        };

        var result = await _controller.EvaluateWaterBalance(request);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var balance = Assert.IsType<DailyWaterBalanceResultDto>(ok.Value);
        Assert.Equal(37.00m, balance.DepletionMm);
        Assert.True(balance.TriggerIrrigation);
        Assert.NotNull(balance.RefillPlan);
        Assert.Equal(37.00m, balance.RefillPlan!.EffectiveDeliveredMm);
        Assert.Equal(0.00m, balance.RefillPlan.PostIrrigationDepletionMm);
    }

    [Fact]
    public async Task EvaluateWaterBalance_InvalidOrMissingInputs_Returns400And404ProblemDetails()
    {
        _fakeEngine.SoilProfileHandler = id => Task.FromResult<SoilProfile?>(id == "sandy_loam" ? SandyLoam : null);

        var nullBody = Assert.IsType<ObjectResult>((await _controller.EvaluateWaterBalance(null)).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, nullBody.StatusCode);

        var emptySoil = Assert.IsType<ObjectResult>((await _controller.EvaluateWaterBalance(new DailyWaterBalanceRequestDto { SoilProfileId = "" })).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, emptySoil.StatusCode);

        var unknownSoil = Assert.IsType<ObjectResult>((await _controller.EvaluateWaterBalance(new DailyWaterBalanceRequestDto { SoilProfileId = "volcanic_ash" })).Result);
        Assert.Equal(StatusCodes.Status404NotFound, unknownSoil.StatusCode);

        var invalidParam = Assert.IsType<ObjectResult>((await _controller.EvaluateWaterBalance(new DailyWaterBalanceRequestDto
        {
            SoilProfileId = "sandy_loam",
            PreviousDepletionMm = -5.0m
        })).Result);
        Assert.Equal(StatusCodes.Status400BadRequest, invalidParam.StatusCode);
    }

    [Fact]
    public async Task EvaluateParcelIrrigation_Handles200And404And400Cleanly()
    {
        var parcelId = Guid.NewGuid();
        var notFound = Assert.IsType<ObjectResult>((await _controller.EvaluateParcelIrrigation(parcelId)).Result);
        Assert.Equal(StatusCodes.Status404NotFound, notFound.StatusCode);

        _fakeEngine.ParcelEvalHandler = (id, _) => Task.FromResult<ParcelIrrigationEvaluationResponseDto?>(new ParcelIrrigationEvaluationResponseDto
        {
            ParcelId = id,
            ParcelName = "Block A",
            CropType = "Tomato",
            TargetDate = new DateOnly(2026, 7, 1),
            Kc = 1.15m,
            Et0Mm = 5.00m,
            WaterBalance = _fakeEngine.ComputeDailyWaterBalance(SandyLoam, 32m, 5.75m, 0m, 0m, 0.60m, 1m, 0.88m, 500m),
            EventCreated = true,
            EventAlreadyActive = false,
            ScheduledEvent = new IrrigationEventDto
            {
                Id = Guid.NewGuid(),
                TriggerType = IrrigationTriggerType.AutomatedDeficit,
                Status = IrrigationEventStatus.Pending,
                ScheduledStart = DateTime.UtcNow,
                DurationMinutes = 858,
                WaterVolumeLiters = 428_977.27m
            }
        });

        var ok = Assert.IsType<OkObjectResult>((await _controller.EvaluateParcelIrrigation(parcelId)).Result);
        var payload = Assert.IsType<ParcelIrrigationEvaluationResponseDto>(ok.Value);
        Assert.True(payload.EventCreated);
        Assert.Equal(IrrigationTriggerType.AutomatedDeficit, payload.ScheduledEvent!.TriggerType);
        Assert.Equal(IrrigationEventStatus.Pending, payload.ScheduledEvent.Status);

        // Unprocessable parcel configuration (e.g., area_hectares == 0) -> 422 ProblemDetails
        _fakeEngine.ParcelEvalHandler = (_, _) => throw new InvalidOperationException("Parcel has invalid area_hectares (0.00).");
        var unprocessable = Assert.IsType<ObjectResult>((await _controller.EvaluateParcelIrrigation(parcelId)).Result);
        Assert.Equal(StatusCodes.Status422UnprocessableEntity, unprocessable.StatusCode);
    }
}
