using AgriTech.Api.Configuration;
using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AgriTech.Api.Tests;

public class CropPhenologyServiceTests
{
    private readonly CropPhenologyService _service;

    public CropPhenologyServiceTests()
    {
        var options = Options.Create(new CropPhenologyOptions
        {
            ConfigFilePath = Path.Combine("Configuration", "crop_growth_stages.json")
        });

        _service = new CropPhenologyService(options, NullLogger<CropPhenologyService>.Instance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Static Configuration Loading (crop_growth_stages.json)
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Configuration_LoadsAllFourRequiredCropsWithFao56Constants()
    {
        var crops = _service.GetSupportedCrops();

        Assert.Equal(4, crops.Count);
        Assert.Contains(crops, c => c.CropType == "Tomato" && c.TotalCycleDays == 145 && c.Stages.MidSeason.Kc == 1.15m);
        Assert.Contains(crops, c => c.CropType == "Corn"   && c.TotalCycleDays == 125 && c.Stages.MidSeason.Kc == 1.20m);
        Assert.Contains(crops, c => c.CropType == "Potato" && c.TotalCycleDays == 130 && c.Stages.MidSeason.Kc == 1.15m);
        Assert.Contains(crops, c => c.CropType == "Apple"  && c.TotalCycleDays == 270 && c.Stages.MidSeason.Kc == 0.95m && c.IsPerennial);
    }

    [Theory]
    [InlineData("tomato", "Tomato")]
    [InlineData("TOMATO", "Tomato")]
    [InlineData("  Corn  ", "Corn")]
    [InlineData("pOtAtO", "Potato")]
    [InlineData("APPLE", "Apple")]
    public void GetCropProfile_IsCaseInsensitiveAndTrimsWhitespace(string input, string expectedCanonicalName)
    {
        var profile = _service.GetCropProfile(input);
        Assert.Equal(expectedCanonicalName, profile.CropType);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Acceptance Criterion 1: Mid-Season Peak Kc Plateau
    // ─────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Tomato", 70, 1.15)]  // Start of mid-season (30 + 40)
    [InlineData("Tomato", 92, 1.15)]  // Middle of mid-season
    [InlineData("Tomato", 114, 1.15)] // Last day of mid-season (30 + 40 + 45 - 1)
    [InlineData("Potato", 55, 1.15)]  // Start of mid-season (25 + 30)
    [InlineData("Potato", 77, 1.15)]  // Middle of mid-season
    [InlineData("Potato", 99, 1.15)]  // Last day of mid-season (25 + 30 + 45 - 1)
    [InlineData("Corn", 55, 1.20)]    // Start of mid-season (20 + 35)
    [InlineData("Corn", 75, 1.20)]    // Middle of mid-season
    [InlineData("Corn", 94, 1.20)]    // Last day of mid-season (20 + 35 + 40 - 1)
    [InlineData("Apple", 90, 0.95)]   // Start of mid-season (20 + 70)
    [InlineData("Apple", 150, 0.95)]  // Middle of mid-season
    [InlineData("Apple", 209, 0.95)]  // Last day of mid-season (20 + 70 + 120 - 1)
    public void CalculateCurrentKc_MidSeasonPlateau_ResolvesToExactPeakKc(
        string cropType,
        int daysAfterPlanting,
        decimal expectedPeakKc)
    {
        var plantingDate = new DateOnly(2026, 3, 1);
        var targetDate = plantingDate.AddDays(daysAfterPlanting);

        var kc = _service.CalculateCurrentKc(cropType, plantingDate, targetDate);
        var assessment = _service.AssessCropPhenology(cropType, plantingDate, targetDate);

        Assert.Equal(expectedPeakKc, kc);
        Assert.Equal(PhenologicalStage.MidSeason, assessment.Stage);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Exact Transition Points Across Full Lifecycle (All 4 Crops)
    // ─────────────────────────────────────────────────────────────────────────

    [Theory]
    // Tomato: 0.60 -> 1.15 -> 0.80 | L: 30, 40, 45, 30 (Harvest = 145)
    [InlineData("Tomato", -5,  0.6000, PhenologicalStage.PrePlanting)]
    [InlineData("Tomato", 0,   0.6000, PhenologicalStage.Initial)]
    [InlineData("Tomato", 29,  0.6000, PhenologicalStage.Initial)]
    [InlineData("Tomato", 30,  0.6000, PhenologicalStage.Development)] // L_ini boundary (zero step)
    [InlineData("Tomato", 50,  0.8750, PhenologicalStage.Development)] // 50% dev midpoint
    [InlineData("Tomato", 70,  1.1500, PhenologicalStage.MidSeason)]   // L_dev -> L_mid boundary
    [InlineData("Tomato", 114, 1.1500, PhenologicalStage.MidSeason)]
    [InlineData("Tomato", 115, 1.1500, PhenologicalStage.LateSeason)]  // L_mid -> L_late boundary (zero step)
    [InlineData("Tomato", 130, 0.9750, PhenologicalStage.LateSeason)]  // 50% late midpoint
    [InlineData("Tomato", 145, 0.8000, PhenologicalStage.LateSeason)]  // Harvest day exact Kc_end
    [InlineData("Tomato", 160, 0.8000, PhenologicalStage.PostHarvest)] // Post-harvest clamp
    // Potato: 0.50 -> 1.15 -> 0.75 | L: 25, 30, 45, 30 (Harvest = 130)
    [InlineData("Potato", 0,   0.5000, PhenologicalStage.Initial)]
    [InlineData("Potato", 24,  0.5000, PhenologicalStage.Initial)]
    [InlineData("Potato", 25,  0.5000, PhenologicalStage.Development)]
    [InlineData("Potato", 40,  0.8250, PhenologicalStage.Development)] // 50% dev midpoint
    [InlineData("Potato", 55,  1.1500, PhenologicalStage.MidSeason)]
    [InlineData("Potato", 100, 1.1500, PhenologicalStage.LateSeason)]
    [InlineData("Potato", 115, 0.9500, PhenologicalStage.LateSeason)]  // 50% late midpoint
    [InlineData("Potato", 130, 0.7500, PhenologicalStage.LateSeason)]
    [InlineData("Potato", 140, 0.7500, PhenologicalStage.PostHarvest)]
    // Corn: 0.30 -> 1.20 -> 0.35 | L: 20, 35, 40, 30 (Harvest = 125)
    [InlineData("Corn", 0,   0.3000, PhenologicalStage.Initial)]
    [InlineData("Corn", 19,  0.3000, PhenologicalStage.Initial)]
    [InlineData("Corn", 20,  0.3000, PhenologicalStage.Development)]
    [InlineData("Corn", 55,  1.2000, PhenologicalStage.MidSeason)]
    [InlineData("Corn", 95,  1.2000, PhenologicalStage.LateSeason)]
    [InlineData("Corn", 110, 0.7750, PhenologicalStage.LateSeason)]    // 50% late midpoint
    [InlineData("Corn", 125, 0.3500, PhenologicalStage.LateSeason)]
    [InlineData("Corn", 135, 0.3500, PhenologicalStage.PostHarvest)]
    // Apple: 0.45 -> 0.95 -> 0.70 | L: 20, 70, 120, 60 (Harvest = 270)
    [InlineData("Apple", 0,   0.4500, PhenologicalStage.Initial)]
    [InlineData("Apple", 19,  0.4500, PhenologicalStage.Initial)]
    [InlineData("Apple", 20,  0.4500, PhenologicalStage.Development)]
    [InlineData("Apple", 55,  0.7000, PhenologicalStage.Development)]  // 50% dev midpoint
    [InlineData("Apple", 90,  0.9500, PhenologicalStage.MidSeason)]
    [InlineData("Apple", 210, 0.9500, PhenologicalStage.LateSeason)]
    [InlineData("Apple", 240, 0.8250, PhenologicalStage.LateSeason)]   // 50% late midpoint
    [InlineData("Apple", 270, 0.7000, PhenologicalStage.LateSeason)]
    [InlineData("Apple", 300, 0.7000, PhenologicalStage.PostHarvest)]
    public void AssessCropPhenology_AtEveryTransitionBoundary_MatchesExactExpectedKcAndStage(
        string cropType,
        int dap,
        decimal expectedKc,
        PhenologicalStage expectedStage)
    {
        var plantingDate = new DateOnly(2026, 3, 1);
        var targetDate = plantingDate.AddDays(dap);

        var assessment = _service.AssessCropPhenology(cropType, plantingDate, targetDate);

        Assert.Equal(expectedKc, assessment.Kc);
        Assert.Equal(expectedStage, assessment.Stage);
        Assert.Equal(dap, assessment.DaysAfterPlanting);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Acceptance Criterion 2: Smooth Linear Transitions (Zero Discontinuity)
    // ─────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Tomato")]
    [InlineData("Corn")]
    [InlineData("Potato")]
    [InlineData("Apple")]
    public void CalculateCurrentKc_EveryConsecutiveDayAcrossFullLifecycle_HasSmoothSlopeAndNoSteppedDiscontinuity(
        string cropType)
    {
        var profile = _service.GetCropProfile(cropType);
        var plantingDate = new DateOnly(2026, 3, 1);

        int devStart = profile.DevelopmentStartDay;
        int midStart = profile.MidSeasonStartDay;
        int lateStart = profile.LateSeasonStartDay;
        int harvestDay = profile.TotalCycleDays;

        decimal expectedDevSlope = (profile.Stages.MidSeason.Kc - profile.Stages.Initial.Kc) / profile.Stages.Development.DurationDays;
        decimal expectedLateSlope = -(profile.Stages.MidSeason.Kc - profile.Stages.LateSeason.KcEnd) / profile.Stages.LateSeason.DurationDays;

        // Tolerance accounts solely for 4-decimal rounding (max difference between two rounded points <= 0.00015)
        const decimal roundingTolerance = 0.0002m;

        // 1. Verify exact boundary joins (zero discontinuity at stage entry)
        Assert.Equal(profile.Stages.Initial.Kc, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(devStart - 1)));
        Assert.Equal(profile.Stages.Initial.Kc, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(devStart)));

        Assert.Equal(profile.Stages.MidSeason.Kc, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(midStart)));
        Assert.Equal(profile.Stages.MidSeason.Kc, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(lateStart - 1)));
        Assert.Equal(profile.Stages.MidSeason.Kc, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(lateStart)));

        Assert.Equal(profile.Stages.LateSeason.KcEnd, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(harvestDay)));
        Assert.Equal(profile.Stages.LateSeason.KcEnd, _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(harvestDay + 1)));

        // 2. Verify every single daily increment across Development ramp (L_ini -> L_mid)
        for (int day = devStart; day < midStart; day++)
        {
            var kcToday = _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(day));
            var kcNext = _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(day + 1));
            var actualStep = kcNext - kcToday;

            Assert.True(
                Math.Abs(actualStep - expectedDevSlope) <= roundingTolerance,
                $"{cropType} dev discontinuity at DAP {day}->{day + 1}: expected step {expectedDevSlope:F5}, actual {actualStep:F5}");
        }

        // 3. Verify every single daily decrement across Late-Season ramp (L_mid -> L_late)
        for (int day = lateStart; day < harvestDay; day++)
        {
            var kcToday = _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(day));
            var kcNext = _service.CalculateCurrentKc(cropType, plantingDate, plantingDate.AddDays(day + 1));
            var actualStep = kcNext - kcToday;

            Assert.True(
                Math.Abs(actualStep - expectedLateSlope) <= roundingTolerance,
                $"{cropType} late-season discontinuity at DAP {day}->{day + 1}: expected step {expectedLateSlope:F5}, actual {actualStep:F5}");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Perennial Orchard Multi-Year, Leap-Year & DateOnly.MaxValue Cycling
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Apple_PerennialMultiYearOrchard_CyclesAnnuallyFromLeafOutAnniversary()
    {
        var orchardPlantedDate = new DateOnly(2023, 3, 1);

        // Year 4 budbreak (2026-03-01) -> Day 0 of annual cycle -> Initial (0.45)
        var budbreak = _service.AssessCropPhenology("Apple", orchardPlantedDate, new DateOnly(2026, 3, 1));
        Assert.Equal(0, budbreak.EffectiveCycleDay);
        Assert.Equal(PhenologicalStage.Initial, budbreak.Stage);
        Assert.Equal(0.45m, budbreak.Kc);

        // Year 4 summer mid-season (2026-06-15 -> 106 days after March 1) -> Mid-Season (0.95)
        var summer = _service.AssessCropPhenology("Apple", orchardPlantedDate, new DateOnly(2026, 6, 15));
        Assert.Equal(106, summer.EffectiveCycleDay);
        Assert.Equal(PhenologicalStage.MidSeason, summer.Stage);
        Assert.Equal(0.95m, summer.Kc);

        // Year 4 winter dormancy (2026-12-15 -> 289 days after March 1 > 270) -> PostHarvest (0.70)
        var winter = _service.AssessCropPhenology("Apple", orchardPlantedDate, new DateOnly(2026, 12, 15));
        Assert.Equal(289, winter.EffectiveCycleDay);
        Assert.Equal(PhenologicalStage.PostHarvest, winter.Stage);
        Assert.Equal(0.70m, winter.Kc);

        // Feb 28 before next year's March 1 leaf-out -> still in previous cycle dormancy (364)
        var lateWinter = _service.AssessCropPhenology("Apple", orchardPlantedDate, new DateOnly(2027, 2, 28));
        Assert.Equal(364, lateWinter.EffectiveCycleDay);
        Assert.Equal(PhenologicalStage.PostHarvest, lateWinter.Stage);
        Assert.Equal(0.70m, lateWinter.Kc);
    }

    [Fact]
    public void Apple_PlantedOnLeapDay_DoesNotThrowOnNonLeapYear()
    {
        var leapPlanting = new DateOnly(2024, 2, 29);
        var nonLeapTarget = new DateOnly(2026, 3, 1);

        var assessment = _service.AssessCropPhenology("Apple", leapPlanting, nonLeapTarget);

        Assert.Equal(1, assessment.EffectiveCycleDay);
        Assert.Equal(PhenologicalStage.Initial, assessment.Stage);
        Assert.Equal(0.45m, assessment.Kc);
    }

    [Fact]
    public void Apple_PlantedInYear9999_DoesNotOverflowDateOnly()
    {
        var plantingDate = new DateOnly(9999, 1, 1);
        var targetDate = new DateOnly(9999, 5, 1);

        var kc = _service.CalculateCurrentKc("Apple", plantingDate, targetDate);

        Assert.Equal(0.95m, kc); // DAP = 120 -> Mid-Season
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Derived Agronomic Calculations (ETc, Effective Root Depth, Curve)
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void CalculateCropEvapotranspiration_HandlesZeroAndPositiveEt0Accurately()
    {
        var plantingDate = new DateOnly(2026, 4, 1);
        var midSeasonDate = plantingDate.AddDays(90); // Tomato Mid-Season Kc = 1.15

        Assert.Equal(0.00m, _service.CalculateCropEvapotranspiration("Tomato", plantingDate, midSeasonDate, et0Mm: 0m));
        Assert.Equal(5.75m, _service.CalculateCropEvapotranspiration("Tomato", plantingDate, midSeasonDate, et0Mm: 5.00m));

        var assessment = _service.AssessCropPhenology("Tomato", plantingDate, midSeasonDate, et0Mm: 5.00m);
        Assert.Equal(5.00m, assessment.Et0Mm);
        Assert.Equal(5.75m, assessment.EtcMm);
    }

    [Fact]
    public void CalculateEffectiveRootDepthMeters_ExpandsLinearlyDuringDevelopmentToMaturityDepth()
    {
        var plantingDate = new DateOnly(2026, 4, 1);
        // Tomato default max root depth = 0.60m, initial ratio = 0.25 -> 0.150m, mature ratio = 1.00 -> 0.600m

        var initialDepth = _service.CalculateEffectiveRootDepthMeters("Tomato", plantingDate, plantingDate.AddDays(10));
        var devMidDepth = _service.CalculateEffectiveRootDepthMeters("Tomato", plantingDate, plantingDate.AddDays(50)); // 50% dev -> ratio 0.625 -> 0.375m
        var matureDepth = _service.CalculateEffectiveRootDepthMeters("Tomato", plantingDate, plantingDate.AddDays(80));
        var overrideDepth = _service.CalculateEffectiveRootDepthMeters("Tomato", plantingDate, plantingDate.AddDays(80), maxRootDepthOverrideM: 0.80m);

        Assert.Equal(0.150m, initialDepth);
        Assert.Equal(0.375m, devMidDepth);
        Assert.Equal(0.600m, matureDepth);
        Assert.Equal(0.800m, overrideDepth);
    }

    [Fact]
    public void GenerateLifecycleCurve_ReturnsAllDaysFromZeroThroughHarvestInclusive()
    {
        var plantingDate = new DateOnly(2026, 4, 1);
        var curve = _service.GenerateLifecycleCurve("Tomato", plantingDate);

        Assert.Equal(146, curve.Count); // DAP 0..145 inclusive
        Assert.Equal(0, curve.First().DayAfterPlanting);
        Assert.Equal(0.60m, curve.First().Kc);
        Assert.Equal(145, curve.Last().DayAfterPlanting);
        Assert.Equal(0.80m, curve.Last().Kc);
        Assert.Equal(1.15m, curve.Max(p => p.Kc));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Error Handling, Overflow Protection & Config Invariant Guards
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void CalculateCurrentKc_UnsupportedEmptyOrOversizedCrop_ThrowsExpectedExceptions()
    {
        var date = new DateOnly(2026, 5, 1);

        Assert.Throws<ArgumentException>(() => _service.CalculateCurrentKc("", date, date));
        Assert.Throws<ArgumentException>(() => _service.CalculateCurrentKc("   ", date, date));
        Assert.Throws<ArgumentException>(() => _service.CalculateCurrentKc(new string('A', 81), date, date));
        Assert.Throws<KeyNotFoundException>(() => _service.CalculateCurrentKc("Avocado", date, date));
    }

    [Theory]
    [InlineData(-0.5)]
    [InlineData(100.01)]
    public void CalculateCropEvapotranspiration_OutOfRangeEt0_ThrowsArgumentOutOfRangeException(decimal invalidEt0)
    {
        var date = new DateOnly(2026, 5, 1);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _service.CalculateCropEvapotranspiration("Tomato", date, date, et0Mm: invalidEt0));
    }

    [Fact]
    public void AssessCropPhenology_DecimalMaxEt0_RejectsWithoutOverflowException()
    {
        var date = new DateOnly(2026, 5, 1);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _service.AssessCropPhenology("Tomato", date, date, et0Mm: decimal.MaxValue));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-0.5)]
    public void CalculateEffectiveRootDepthMeters_NonPositiveOverride_ThrowsArgumentOutOfRangeException(decimal invalidDepth)
    {
        var date = new DateOnly(2026, 5, 1);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            _service.CalculateEffectiveRootDepthMeters("Tomato", date, date, maxRootDepthOverrideM: invalidDepth));
    }

    [Fact]
    public void Constructor_InvalidConfigProfiles_ThrowInvalidOperationException()
    {
        static CropGrowthProfile ValidProfile(string name = "TestCrop") => new()
        {
            CropType = name,
            DefaultRootDepthMaxM = 0.60m,
            DefaultMadFraction = 0.50m,
            Stages = new CropStagesDefinition
            {
                Initial = new PlateauStageDefinition { DurationDays = 20, Kc = 0.50m, RootDepthRatio = 0.25m },
                Development = new LinearStageDefinition { DurationDays = 30, KcStart = 0.50m, KcEnd = 1.10m, RootDepthRatioStart = 0.25m, RootDepthRatioEnd = 1.00m },
                MidSeason = new PlateauStageDefinition { DurationDays = 40, Kc = 1.10m, RootDepthRatio = 1.00m },
                LateSeason = new LinearStageDefinition { DurationDays = 20, KcStart = 1.10m, KcEnd = 0.60m, RootDepthRatioStart = 1.00m, RootDepthRatioEnd = 1.00m }
            }
        };

        // 1. Discontinuous Kc jump (0.50 -> 0.70)
        var discontinuousKc = new CropGrowthProfile
        {
            CropType = "BrokenKc",
            DefaultRootDepthMaxM = 0.60m,
            DefaultMadFraction = 0.50m,
            Stages = new CropStagesDefinition
            {
                Initial = new PlateauStageDefinition { DurationDays = 20, Kc = 0.50m, RootDepthRatio = 0.25m },
                Development = new LinearStageDefinition { DurationDays = 30, KcStart = 0.70m, KcEnd = 1.10m, RootDepthRatioStart = 0.25m, RootDepthRatioEnd = 1.00m },
                MidSeason = new PlateauStageDefinition { DurationDays = 40, Kc = 1.10m, RootDepthRatio = 1.00m },
                LateSeason = new LinearStageDefinition { DurationDays = 20, KcStart = 1.10m, KcEnd = 0.60m, RootDepthRatioStart = 1.00m, RootDepthRatioEnd = 1.00m }
            }
        };
        Assert.Throws<InvalidOperationException>(() =>
            new CropPhenologyService(new[] { discontinuousKc }, NullLogger<CropPhenologyService>.Instance));

        // 2. Null sub-stage
        var missingSubStage = new CropGrowthProfile
        {
            CropType = "MissingStage",
            DefaultRootDepthMaxM = 0.60m,
            DefaultMadFraction = 0.50m,
            Stages = new CropStagesDefinition { Initial = null!, Development = null!, MidSeason = null!, LateSeason = null! }
        };
        Assert.Throws<InvalidOperationException>(() =>
            new CropPhenologyService(new[] { missingSubStage }, NullLogger<CropPhenologyService>.Instance));

        // 3. Zero duration
        var zeroDuration = new CropGrowthProfile
        {
            CropType = "ZeroDuration",
            DefaultRootDepthMaxM = 0.60m,
            DefaultMadFraction = 0.50m,
            Stages = new CropStagesDefinition
            {
                Initial = new PlateauStageDefinition { DurationDays = 0, Kc = 0.50m, RootDepthRatio = 0.25m },
                Development = new LinearStageDefinition { DurationDays = 30, KcStart = 0.50m, KcEnd = 1.10m, RootDepthRatioStart = 0.25m, RootDepthRatioEnd = 1.00m },
                MidSeason = new PlateauStageDefinition { DurationDays = 40, Kc = 1.10m, RootDepthRatio = 1.00m },
                LateSeason = new LinearStageDefinition { DurationDays = 20, KcStart = 1.10m, KcEnd = 0.60m, RootDepthRatioStart = 1.00m, RootDepthRatioEnd = 1.00m }
            }
        };
        Assert.Throws<InvalidOperationException>(() =>
            new CropPhenologyService(new[] { zeroDuration }, NullLogger<CropPhenologyService>.Instance));

        // 4. Invalid RootDepthRatio discontinuity
        var brokenRootRatio = new CropGrowthProfile
        {
            CropType = "BrokenRoot",
            DefaultRootDepthMaxM = 0.60m,
            DefaultMadFraction = 0.50m,
            Stages = new CropStagesDefinition
            {
                Initial = new PlateauStageDefinition { DurationDays = 20, Kc = 0.50m, RootDepthRatio = 0.25m },
                Development = new LinearStageDefinition { DurationDays = 30, KcStart = 0.50m, KcEnd = 1.10m, RootDepthRatioStart = 0.50m, RootDepthRatioEnd = 1.00m },
                MidSeason = new PlateauStageDefinition { DurationDays = 40, Kc = 1.10m, RootDepthRatio = 1.00m },
                LateSeason = new LinearStageDefinition { DurationDays = 20, KcStart = 1.10m, KcEnd = 0.60m, RootDepthRatioStart = 1.00m, RootDepthRatioEnd = 1.00m }
            }
        };
        Assert.Throws<InvalidOperationException>(() =>
            new CropPhenologyService(new[] { brokenRootRatio }, NullLogger<CropPhenologyService>.Instance));

        // 5. Duplicate cropType
        Assert.Throws<InvalidOperationException>(() =>
            new CropPhenologyService(new[] { ValidProfile("Tomato"), ValidProfile("tomato") }, NullLogger<CropPhenologyService>.Instance));
    }
}
