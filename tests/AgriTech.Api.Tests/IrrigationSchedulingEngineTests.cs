using AgriTech.Api.Configuration;
using AgriTech.Api.Data;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AgriTech.Api.Tests;

public class IrrigationSchedulingEngineTests
{
    private readonly IrrigationSchedulingEngine _engine;

    private static readonly SoilProfile Sand = new()
    {
        Id = "sand",
        Name = "Sand",
        FieldCapacityPct = 0.120m,
        WiltingPointPct = 0.050m,
        SaturationPct = 0.380m,
        HydraulicConductivity = 50.00m,
        MadThresholdPct = 0.50m
    };

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

    private static readonly SoilProfile Silt = new()
    {
        Id = "silt",
        Name = "Silt",
        FieldCapacityPct = 0.310m,
        WiltingPointPct = 0.140m,
        SaturationPct = 0.480m,
        HydraulicConductivity = 12.50m,
        MadThresholdPct = 0.50m
    };

    private static readonly SoilProfile Clay = new()
    {
        Id = "clay",
        Name = "Clay",
        FieldCapacityPct = 0.380m,
        WiltingPointPct = 0.220m,
        SaturationPct = 0.500m,
        HydraulicConductivity = 2.50m,
        MadThresholdPct = 0.50m
    };

    public IrrigationSchedulingEngineTests()
    {
        var dbOptions = new DbContextOptionsBuilder<AgriTechDbContext>().Options;
        var dbContext = new AgriTechDbContext(dbOptions);
        var phenology = new CropPhenologyService(
            Options.Create(new CropPhenologyOptions { ConfigFilePath = Path.Combine("Configuration", "crop_growth_stages.json") }),
            NullLogger<CropPhenologyService>.Instance);

        _engine = new IrrigationSchedulingEngine(
            dbContext,
            phenology,
            NullLogger<IrrigationSchedulingEngine>.Instance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Soil Hydraulic Parameters Lookup (TAW & RAW)
    // ─────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("sand",       0.60, 42.00,  21.00)]
    [InlineData("sandy_loam", 0.60, 72.00,  36.00)]
    [InlineData("silt",       1.00, 170.00, 85.00)]
    [InlineData("clay",       1.50, 240.00, 120.00)]
    public void CalculateHydraulicCapacity_AllSeededSoilProfiles_ComputesExactTawAndRaw(
        string profileKey,
        decimal rootDepthM,
        decimal expectedTawMm,
        decimal expectedRawMm)
    {
        var profile = profileKey switch
        {
            "sand" => Sand,
            "sandy_loam" => SandyLoam,
            "silt" => Silt,
            "clay" => Clay,
            _ => throw new ArgumentOutOfRangeException(nameof(profileKey))
        };

        var capacity = _engine.CalculateHydraulicCapacity(profile, rootDepthM);

        Assert.Equal(expectedTawMm, capacity.TawMm);
        Assert.Equal(expectedRawMm, capacity.RawMm);
        Assert.Equal(profile.MadThresholdPct, capacity.MadFraction);
    }

    [Fact]
    public void CalculateHydraulicCapacity_WithCustomMadOverride_ScalesRawAccordingly()
    {
        // Sandy Loam + Tomato (Zr = 0.60m -> TAW = 72.00mm) with Tomato MAD p = 0.40 -> RAW = 28.80mm
        var capacity = _engine.CalculateHydraulicCapacity(SandyLoam, effectiveRootDepthM: 0.60m, madFractionOverride: 0.40m);

        Assert.Equal(72.00m, capacity.TawMm);
        Assert.Equal(28.80m, capacity.RawMm);
        Assert.Equal(0.40m, capacity.MadFraction);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Daily Soil Water Balance Equation & Actuation Boundary (Dr >= RAW)
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void ComputeDailyWaterBalance_BelowRawThreshold_DoesNotTriggerIrrigation()
    {
        // Sandy Loam Zr = 0.60m -> TAW = 72.00mm, RAW = 36.00mm
        // Dr,t = 30.00 + 5.99 - 0 - 0 = 35.99mm < 36.00mm -> NO trigger
        var result = _engine.ComputeDailyWaterBalance(
            SandyLoam,
            previousDepletionMm: 30.00m,
            etcMm: 5.99m,
            precipitationMm: 0.00m,
            irrigationMm: 0.00m,
            effectiveRootDepthM: 0.60m,
            areaHectares: 1.00m,
            irrigationEfficiency: 0.88m,
            systemFlowRateLpm: 500.00m);

        Assert.Equal(35.99m, result.DepletionMm);
        Assert.False(result.TriggerIrrigation);
        Assert.Null(result.RefillPlan);
        Assert.Equal(0.00m, result.DeepPercolationMm);
        Assert.True(result.HoursUntilTrigger > 0m);
    }

    [Fact]
    public void ComputeDailyWaterBalance_ExactlyAtRawThreshold_TriggersAutomatedIrrigation()
    {
        // Dr,t = 30.00 + 6.00 - 0 - 0 = 36.00mm == RAW -> TRIGGER
        var result = _engine.ComputeDailyWaterBalance(
            SandyLoam,
            previousDepletionMm: 30.00m,
            etcMm: 6.00m,
            precipitationMm: 0.00m,
            irrigationMm: 0.00m,
            effectiveRootDepthM: 0.60m,
            areaHectares: 1.00m,
            irrigationEfficiency: 0.88m,
            systemFlowRateLpm: 500.00m);

        Assert.Equal(36.00m, result.DepletionMm);
        Assert.Equal(1.0000m, result.DepletionRatioOfRaw);
        Assert.True(result.TriggerIrrigation);
        Assert.Equal(0.0m, result.HoursUntilTrigger);
        Assert.NotNull(result.RefillPlan);
        Assert.Equal(36.00m, result.RefillPlan!.NetRefillDepthMm);
        Assert.Equal(IrrigationEventConstants.ReasonMadExceededDeficitRecovery, result.RefillPlan.Reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Acceptance Criterion 1: Simulated Rain Events (P > 5 mm)
    // ─────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(0.00, 0.00, 26.00)]  // No rain
    [InlineData(3.50, 0.00, 26.00)]  // Light rain <= 5mm -> Peff = 0, no reduction
    [InlineData(5.00, 0.00, 26.00)]  // Threshold rain = 5mm -> Peff = 0, no reduction
    [InlineData(13.00, 6.00, 20.00)] // Significant rain: Peff = (13-5)*0.75 = 6.00mm -> Dr = 20 + 6 - 6 = 20.00mm
    [InlineData(25.00, 15.00, 11.00)] // Strong rain: Peff = (25-5)*0.75 = 15.00mm -> Dr = 20 + 6 - 15 = 11.00mm
    public void ComputeDailyWaterBalance_SimulatedRainEvents_ReduceDepletionByEffectiveRainfall(
        decimal rainMm,
        decimal expectedPeffMm,
        decimal expectedDepletionMm)
    {
        // Start at Dr,t-1 = 20.00mm, ETc = 6.00mm -> without rain Dr would be 26.00mm
        var result = _engine.ComputeDailyWaterBalance(
            SandyLoam,
            previousDepletionMm: 20.00m,
            etcMm: 6.00m,
            precipitationMm: rainMm,
            irrigationMm: 0.00m,
            effectiveRootDepthM: 0.60m,
            areaHectares: 1.00m,
            irrigationEfficiency: 0.88m,
            systemFlowRateLpm: 200.00m);

        Assert.Equal(expectedPeffMm, result.EffectivePrecipitationMm);
        Assert.Equal(expectedDepletionMm, result.DepletionMm);
        Assert.Equal(0.00m, result.DeepPercolationMm);
    }

    [Fact]
    public void ComputeDailyWaterBalance_SignificantRain_PreventsUnnecessaryIrrigationTrigger()
    {
        // Without rain: Dr = 33.00 + 5.00 = 38.00mm >= RAW (36.00mm) -> would trigger!
        // With 13mm rain: Peff = 6.00mm -> Dr = 33.00 + 5.00 - 6.00 = 32.00mm < RAW -> NO trigger!
        var dryRun = _engine.ComputeDailyWaterBalance(
            SandyLoam, 33.00m, 5.00m, precipitationMm: 0.00m, irrigationMm: 0.00m,
            effectiveRootDepthM: 0.60m, areaHectares: 1.00m, irrigationEfficiency: 0.88m, systemFlowRateLpm: 200.00m);

        var rainyRun = _engine.ComputeDailyWaterBalance(
            SandyLoam, 33.00m, 5.00m, precipitationMm: 13.00m, irrigationMm: 0.00m,
            effectiveRootDepthM: 0.60m, areaHectares: 1.00m, irrigationEfficiency: 0.88m, systemFlowRateLpm: 200.00m);

        Assert.True(dryRun.TriggerIrrigation);
        Assert.Equal(38.00m, dryRun.DepletionMm);

        Assert.False(rainyRun.TriggerIrrigation);
        Assert.Equal(6.00m, rainyRun.EffectivePrecipitationMm);
        Assert.Equal(32.00m, rainyRun.DepletionMm);
        Assert.Null(rainyRun.RefillPlan);
    }

    [Fact]
    public void ComputeDailyWaterBalance_HeavyStormExceedingFieldCapacity_ClampsDepletionAtZeroWithDeepPercolation()
    {
        // Dr,t-1 = 15.00mm, ETc = 4.00mm, P = 65.00mm -> Peff = (65-5)*0.75 = 45.00mm
        // Raw Dr = 15 + 4 - 45 = -26.00mm -> clamped to 0.00mm (100% FC), DP = 26.00mm
        var result = _engine.ComputeDailyWaterBalance(
            SandyLoam,
            previousDepletionMm: 15.00m,
            etcMm: 4.00m,
            precipitationMm: 65.00m,
            irrigationMm: 0.00m,
            effectiveRootDepthM: 0.60m,
            areaHectares: 1.00m,
            irrigationEfficiency: 0.88m,
            systemFlowRateLpm: 200.00m);

        Assert.Equal(45.00m, result.EffectivePrecipitationMm);
        Assert.Equal(0.00m, result.DepletionMm);
        Assert.Equal(26.00m, result.DeepPercolationMm);
        Assert.Equal(22.00m, result.EstimatedMoisturePct); // 100% of Sandy Loam Field Capacity (0.220 * 100)
        Assert.False(result.TriggerIrrigation);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Acceptance Criterion 2: Precise Refill Volume to 100% Field Capacity
    // ─────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("sand",       0.60, 0.50, 0.88, 250.00, 21.00)]
    [InlineData("sandy_loam", 0.60, 1.00, 0.88, 500.00, 36.00)]
    [InlineData("silt",       1.00, 2.50, 0.90, 800.00, 85.00)]
    [InlineData("clay",       1.50, 1.25, 0.85, 600.00, 120.00)]
    [InlineData("sandy_loam", 0.60, 3.00, 1.00, 1000.00, 40.50)]
    public void ComputeDailyWaterBalance_TriggeredRefillVolume_PreciselyRestoresSoilTo100PercentFieldCapacity(
        string profileKey,
        decimal rootDepthM,
        decimal areaHectares,
        decimal efficiency,
        decimal flowRateLpm,
        decimal triggerDepletionMm)
    {
        var profile = profileKey switch
        {
            "sand" => Sand,
            "sandy_loam" => SandyLoam,
            "silt" => Silt,
            "clay" => Clay,
            _ => throw new ArgumentOutOfRangeException(nameof(profileKey))
        };

        var triggerResult = _engine.ComputeDailyWaterBalance(
            profile,
            previousDepletionMm: triggerDepletionMm,
            etcMm: 0.00m,
            precipitationMm: 0.00m,
            irrigationMm: 0.00m,
            effectiveRootDepthM: rootDepthM,
            areaHectares: areaHectares,
            irrigationEfficiency: efficiency,
            systemFlowRateLpm: flowRateLpm);

        Assert.True(triggerResult.TriggerIrrigation);
        Assert.NotNull(triggerResult.RefillPlan);

        var plan = triggerResult.RefillPlan!;
        var areaSqm = areaHectares * 10_000m;
        var expectedGrossLiters = Math.Round((triggerDepletionMm * areaSqm) / efficiency, 2, MidpointRounding.AwayFromZero);
        var expectedDurationMin = Math.Max(1, (int)Math.Round(expectedGrossLiters / flowRateLpm, MidpointRounding.AwayFromZero));
        var expectedFcPct = Math.Round(profile.FieldCapacityPct * 100m, 2, MidpointRounding.AwayFromZero);

        // 1. Exact volume and valve duration verification
        Assert.Equal(triggerDepletionMm, plan.NetRefillDepthMm);
        Assert.Equal(expectedGrossLiters, plan.GrossVolumeLiters);
        Assert.Equal(expectedDurationMin, plan.DurationMinutes);
        Assert.Equal(triggerDepletionMm, plan.EffectiveDeliveredMm);
        Assert.Equal(0.00m, plan.PostIrrigationDepletionMm);
        Assert.Equal(expectedFcPct, plan.PostIrrigationMoisturePct);

        // 2. Round-trip proof: applying the generated irrigation depth returns Dr to 0.00mm and moisture to 100% FC!
        var afterIrrigation = _engine.ComputeDailyWaterBalance(
            profile,
            previousDepletionMm: triggerResult.DepletionMm,
            etcMm: 0.00m,
            precipitationMm: 0.00m,
            irrigationMm: plan.EffectiveDeliveredMm,
            effectiveRootDepthM: rootDepthM,
            areaHectares: areaHectares,
            irrigationEfficiency: efficiency,
            systemFlowRateLpm: flowRateLpm);

        Assert.Equal(0.00m, afterIrrigation.DepletionMm);
        Assert.Equal(expectedFcPct, afterIrrigation.EstimatedMoisturePct);
        Assert.False(afterIrrigation.TriggerIrrigation);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Multi-Day Rolling Simulation, Moisture Bijection & HoursUntilTrigger
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void MultiDaySimulation_DrySpellFollowedByRainThenRefill_TracksWaterBalanceAccurately()
    {
        // Sandy Loam + Tomato mature (Zr = 0.60m -> TAW = 72mm, RAW = 36mm)
        // Daily ETc = 6.00mm; Day 3 has 13mm rain (Peff = 6mm -> net 0 change);
        // Depletion progression: D0=0 -> D1=6 -> D2=12 -> D3=12 -> D4=18 -> D5=24 -> D6=30 -> D7=36 (TRIGGER!)
        decimal depletion = 0.00m;
        decimal[] dailyRain = [0m, 0m, 13m, 0m, 0m, 0m, 0m];
        DailyWaterBalanceResultDto? lastResult = null;

        for (int day = 0; day < dailyRain.Length; day++)
        {
            lastResult = _engine.ComputeDailyWaterBalance(
                SandyLoam,
                previousDepletionMm: depletion,
                etcMm: 6.00m,
                precipitationMm: dailyRain[day],
                irrigationMm: 0.00m,
                effectiveRootDepthM: 0.60m,
                areaHectares: 1.00m,
                irrigationEfficiency: 0.88m,
                systemFlowRateLpm: 500.00m);

            depletion = lastResult.DepletionMm;

            if (day < 6)
            {
                Assert.False(lastResult.TriggerIrrigation, $"Should not trigger on day {day + 1}");
            }
        }

        Assert.NotNull(lastResult);
        Assert.Equal(36.00m, lastResult!.DepletionMm);
        Assert.True(lastResult.TriggerIrrigation);
        Assert.Equal(409_090.91m, lastResult.RefillPlan!.GrossVolumeLiters);
    }

    [Fact]
    public void ComputeDepletionFromMoisturePct_ConvertsBetweenVwcAndDepletionConsistently()
    {
        // Sandy Loam: FC = 22.0%, WP = 10.0%, Zr = 0.60m -> TAW = 72.00mm, RAW (p=0.5) = 36.00mm (at VWC = 16.0%)
        Assert.Equal(0.00m, _engine.ComputeDepletionFromMoisturePct(SandyLoam, soilMoisturePct: 22.0m, effectiveRootDepthM: 0.60m));
        Assert.Equal(0.00m, _engine.ComputeDepletionFromMoisturePct(SandyLoam, soilMoisturePct: 30.0m, effectiveRootDepthM: 0.60m)); // Above FC clamps to 0
        Assert.Equal(36.00m, _engine.ComputeDepletionFromMoisturePct(SandyLoam, soilMoisturePct: 16.0m, effectiveRootDepthM: 0.60m)); // Exact MAD
        Assert.Equal(72.00m, _engine.ComputeDepletionFromMoisturePct(SandyLoam, soilMoisturePct: 10.0m, effectiveRootDepthM: 0.60m)); // Exact WP
        Assert.Equal(72.00m, _engine.ComputeDepletionFromMoisturePct(SandyLoam, soilMoisturePct: 5.0m, effectiveRootDepthM: 0.60m));  // Below WP clamps to TAW
    }

    [Fact]
    public void EstimateHoursUntilTrigger_ComputesExactHoursOrNullWhenNotDrying()
    {
        // Already triggered -> 0.0 h
        Assert.Equal(0.0m, _engine.EstimateHoursUntilTrigger(36.00m, 36.00m, dailyEtcMm: 6.00m, dailyEffectivePrecipMm: 0.00m));
        // 12mm remaining at 6mm/day drying -> 2 days = 48.0 h
        Assert.Equal(48.0m, _engine.EstimateHoursUntilTrigger(24.00m, 36.00m, dailyEtcMm: 6.00m, dailyEffectivePrecipMm: 0.00m));
        // Rain offsets ETc -> not drying -> null
        Assert.Null(_engine.EstimateHoursUntilTrigger(24.00m, 36.00m, dailyEtcMm: 5.00m, dailyEffectivePrecipMm: 8.00m));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Guard Rails & Input Validation
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Engine_InvalidInputs_ThrowArgumentOutOfRangeOrNullException()
    {
        Assert.Throws<ArgumentNullException>(() => _engine.CalculateHydraulicCapacity(null!, 0.60m));

        var invertedSoil = new SoilProfile
        {
            Id = "broken",
            Name = "Broken",
            FieldCapacityPct = 0.15m,
            WiltingPointPct = 0.20m, // WP > FC!
            SaturationPct = 0.40m,
            MadThresholdPct = 0.50m
        };
        Assert.Throws<ArgumentOutOfRangeException>(() => _engine.CalculateHydraulicCapacity(invertedSoil, 0.60m));
        Assert.Throws<ArgumentOutOfRangeException>(() => _engine.CalculateHydraulicCapacity(SandyLoam, 0.00m));
        Assert.Throws<ArgumentOutOfRangeException>(() => _engine.CalculateHydraulicCapacity(SandyLoam, 0.60m, madFractionOverride: 1.5m));

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDailyWaterBalance(SandyLoam, -1m, 5m, 0m, 0m, 0.60m, 1m, 0.88m, 100m));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDailyWaterBalance(SandyLoam, 10m, 5m, 0m, 0m, 0.60m, 0m, 0.88m, 100m));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDailyWaterBalance(SandyLoam, 10m, 5m, 0m, 0m, 0.60m, 1m, 0m, 100m));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDailyWaterBalance(SandyLoam, 10m, 5m, 0m, 0m, 0.60m, 1m, 1.05m, 100m));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDailyWaterBalance(SandyLoam, 10m, 5m, 0m, 0m, 0.60m, 1m, 0.88m, 0m));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDepletionFromMoisturePct(SandyLoam, -5m, 0.60m));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.ComputeDepletionFromMoisturePct(SandyLoam, 105m, 0.60m));

        // Tiny area that would round areaSqm to 0.00m (prevents DivideByZeroException)
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.CalculateRefillPlan(36m, areaHectares: 0.0000001m, irrigationEfficiency: 0.88m, systemFlowRateLpm: 100m, fieldCapacityFraction: 0.22m, effectiveRootDepthM: 0.60m));

        // Tiny efficiency below physical lower bound (prevents decimal OverflowException)
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.CalculateRefillPlan(36m, areaHectares: 1m, irrigationEfficiency: 0.05m, systemFlowRateLpm: 100m, fieldCapacityFraction: 0.22m, effectiveRootDepthM: 0.60m));

        // 74 ha Clay + Apple (120 mm, eta = 0.88 -> 100.9M L) exceeds DB NUMERIC(10,2) cap (prevents Postgres 22003)
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.CalculateRefillPlan(120m, areaHectares: 74m, irrigationEfficiency: 0.88m, systemFlowRateLpm: 5000m, fieldCapacityFraction: 0.38m, effectiveRootDepthM: 1.50m));

        // Small flow rate + large volume exceeding MaxDurationMinutes (43,200 min -> prevents Int32 OverflowException)
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _engine.CalculateRefillPlan(50m, areaHectares: 10m, irrigationEfficiency: 0.88m, systemFlowRateLpm: 1.0m, fieldCapacityFraction: 0.22m, effectiveRootDepthM: 0.60m));
    }

    [Fact]
    public void ComputeDailyWaterBalance_DeepRootZoneHighDepletion_ClampsToDbNumeric52LimitWithoutThrowing()
    {
        // Clay (FC-WP = 0.16) at Zr = 7.0m -> TAW = 1120mm > 999.99mm DB NUMERIC(5,2) max
        // Previous 995 + ETc 10 = 1005 -> clamped cleanly to 999.99mm without throwing inside CalculateRefillPlan
        var result = _engine.ComputeDailyWaterBalance(
            Clay,
            previousDepletionMm: 995.00m,
            etcMm: 10.00m,
            precipitationMm: 0.00m,
            irrigationMm: 0.00m,
            effectiveRootDepthM: 7.00m,
            areaHectares: 1.00m,
            irrigationEfficiency: 0.88m,
            systemFlowRateLpm: 5000.00m);

        Assert.Equal(IrrigationSchedulingEngine.MaxDeficitDepthMm, result.DepletionMm);
        Assert.True(result.TriggerIrrigation);
        Assert.NotNull(result.RefillPlan);
    }

    [Fact]
    public void EnsureUtc_ConvertsLocalDateTimeWithoutTimezoneDrift()
    {
        var localTime = new DateTime(2026, 11, 24, 15, 0, 0, DateTimeKind.Local);
        var expectedUtc = localTime.ToUniversalTime();

        var converted = IrrigationSchedulingEngine.EnsureUtc(localTime);

        Assert.Equal(DateTimeKind.Utc, converted.Kind);
        Assert.Equal(expectedUtc, converted);
    }

    [Fact]
    public void MapToDto_UnrecognizedEnumValue_ThrowsInvalidOperationExceptionInsteadOfSilentFallback()
    {
        var corruptEntity = new IrrigationEvent
        {
            Id = Guid.NewGuid(),
            ParcelId = Guid.NewGuid(),
            TriggerType = "CORRUPT_TRIGGER",
            Status = IrrigationEventConstants.StatusPending,
            ScheduledStart = DateTime.UtcNow,
            DurationMinutes = 15,
            WaterVolumeLiters = 1000m
        };

        Assert.Throws<InvalidOperationException>(() => IrrigationSchedulingEngine.MapToDto(corruptEntity));
    }

    [Fact]
    public void MapToDto_PreservesUppercaseEnumsAndUtcTimestamps()
    {
        var entity = new IrrigationEvent
        {
            Id = Guid.NewGuid(),
            ParcelId = Guid.NewGuid(),
            TriggerType = IrrigationEventConstants.TriggerAutomatedDeficit,
            Status = IrrigationEventConstants.StatusPending,
            DeficitDepthMm = 36.00m,
            ScheduledStart = new DateTime(2026, 11, 24, 18, 0, 0, DateTimeKind.Utc),
            ActualStart = null,
            CompletedAt = null,
            DurationMinutes = 45,
            WaterVolumeLiters = 14200.00m,
            FlowRateLpm = 315.56m,
            Reason = IrrigationEventConstants.ReasonMadExceededDeficitRecovery
        };

        var dto = IrrigationSchedulingEngine.MapToDto(entity);

        Assert.Equal(entity.Id, dto.Id);
        Assert.Equal(IrrigationTriggerType.AutomatedDeficit, dto.TriggerType);
        Assert.Equal(IrrigationEventStatus.Pending, dto.Status);
        Assert.Equal(DateTimeKind.Utc, dto.ScheduledStart.Kind);
        Assert.Null(dto.ActualStart);
        Assert.Null(dto.CompletedAt);
        Assert.Equal(45, dto.DurationMinutes);
        Assert.Equal(14200.00m, dto.WaterVolumeLiters);
    }
}
