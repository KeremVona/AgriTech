using System.Text.Json;
using AgriTech.Api.Configuration;
using AgriTech.Api.Models.DTOs;
using Microsoft.Extensions.Options;

namespace AgriTech.Api.Services;

/// <summary>
/// Implements the FAO-56 Penman-Monteith phenological development stage engine (BACK-302).
/// Loads immutable stage durations and Kc constants from crop_growth_stages.json, validates continuity invariants,
/// and computes smooth piecewise-linear Kc(t), ETc(t), and effective rooting depth Z_r(t).
/// </summary>
public class CropPhenologyService : ICropPhenologyService
{
    public const decimal MaxValidEt0Mm = 100.0m;
    public const int MaxCropTypeLength = 80;

    private const int KcDecimalPrecision = 4;
    private const int DepthDecimalPrecision = 3;
    private const int EtcDecimalPrecision = 2;

    private readonly IReadOnlyDictionary<string, CropGrowthProfile> _profilesByName;
    private readonly IReadOnlyList<CropGrowthProfile> _profiles;
    private readonly ILogger<CropPhenologyService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    private readonly record struct CycleDayEvaluation(
        PhenologicalStage Stage,
        decimal StageProgressPct,
        decimal Kc,
        decimal RootDepthRatio);

    public CropPhenologyService(
        IOptions<CropPhenologyOptions> options,
        ILogger<CropPhenologyService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        var configPath = ResolveConfigPath(options?.Value?.ConfigFilePath);

        if (!File.Exists(configPath))
        {
            throw new FileNotFoundException(
                $"FAO-56 crop growth stages configuration file was not found at '{configPath}'.",
                configPath);
        }

        var json = File.ReadAllText(configPath);
        var document = JsonSerializer.Deserialize<CropGrowthStagesDocument>(json, JsonOptions)
            ?? throw new InvalidOperationException($"Failed to deserialize crop growth stages configuration from '{configPath}'.");

        (_profiles, _profilesByName) = BuildProfileLookup(document.Crops, configPath);

        _logger.LogInformation(
            "Loaded {CropCount} FAO-56 crop phenology profiles ({Crops}) from '{ConfigPath}'.",
            _profiles.Count,
            string.Join(", ", _profiles.Select(c => c.CropType)),
            configPath);
    }

    /// <summary>
    /// Internal constructor enabling direct unit testing with in-memory crop profiles.
    /// </summary>
    internal CropPhenologyService(
        IEnumerable<CropGrowthProfile> profiles,
        ILogger<CropPhenologyService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        (_profiles, _profilesByName) = BuildProfileLookup(
            profiles ?? throw new ArgumentNullException(nameof(profiles)),
            sourceDescription: "in-memory test profiles");
    }

    /// <inheritdoc />
    public decimal CalculateCurrentKc(string cropType, DateOnly plantingDate, DateOnly targetDate)
    {
        var profile = GetCropProfile(cropType);
        var rawDap = targetDate.DayNumber - plantingDate.DayNumber;
        var effectiveDay = ResolveEffectiveCycleDay(profile, plantingDate, targetDate, rawDap);

        return EvaluateCycleDay(profile, effectiveDay).Kc;
    }

    /// <inheritdoc />
    public PhenologyAssessmentDto AssessCropPhenology(
        string cropType,
        DateOnly plantingDate,
        DateOnly targetDate,
        decimal? et0Mm = null,
        decimal? maxRootDepthOverrideM = null)
    {
        if (et0Mm.HasValue)
        {
            ValidateEt0(et0Mm.Value);
        }

        if (maxRootDepthOverrideM.HasValue && maxRootDepthOverrideM.Value <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(maxRootDepthOverrideM), "Maximum root depth must be positive.");
        }

        var profile = GetCropProfile(cropType);
        var rawDap = targetDate.DayNumber - plantingDate.DayNumber;
        var effectiveDay = ResolveEffectiveCycleDay(profile, plantingDate, targetDate, rawDap);
        var eval = EvaluateCycleDay(profile, effectiveDay);

        var maxDepth = maxRootDepthOverrideM ?? profile.DefaultRootDepthMaxM;
        var effectiveRootDepthM = Math.Round(maxDepth * eval.RootDepthRatio, DepthDecimalPrecision, MidpointRounding.AwayFromZero);
        decimal? etcMm = et0Mm.HasValue
            ? Math.Round(eval.Kc * et0Mm.Value, EtcDecimalPrecision, MidpointRounding.AwayFromZero)
            : null;

        return new PhenologyAssessmentDto
        {
            CropType = profile.CropType,
            ScientificName = profile.ScientificName,
            IsPerennial = profile.IsPerennial,
            PlantingDate = plantingDate,
            TargetDate = targetDate,
            DaysAfterPlanting = rawDap,
            EffectiveCycleDay = effectiveDay,
            TotalCycleDays = profile.TotalCycleDays,
            Stage = eval.Stage,
            StageProgressPct = eval.StageProgressPct,
            Kc = eval.Kc,
            RootDepthRatio = eval.RootDepthRatio,
            EffectiveRootDepthM = effectiveRootDepthM,
            DefaultMadFraction = profile.DefaultMadFraction,
            Et0Mm = et0Mm,
            EtcMm = etcMm
        };
    }

    /// <inheritdoc />
    public decimal CalculateCropEvapotranspiration(
        string cropType,
        DateOnly plantingDate,
        DateOnly targetDate,
        decimal et0Mm)
    {
        ValidateEt0(et0Mm);
        var kc = CalculateCurrentKc(cropType, plantingDate, targetDate);
        return Math.Round(kc * et0Mm, EtcDecimalPrecision, MidpointRounding.AwayFromZero);
    }

    /// <inheritdoc />
    public decimal CalculateEffectiveRootDepthMeters(
        string cropType,
        DateOnly plantingDate,
        DateOnly targetDate,
        decimal? maxRootDepthOverrideM = null)
    {
        if (maxRootDepthOverrideM.HasValue && maxRootDepthOverrideM.Value <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(maxRootDepthOverrideM), "Maximum root depth must be positive.");
        }

        var profile = GetCropProfile(cropType);
        var rawDap = targetDate.DayNumber - plantingDate.DayNumber;
        var effectiveDay = ResolveEffectiveCycleDay(profile, plantingDate, targetDate, rawDap);
        var eval = EvaluateCycleDay(profile, effectiveDay);
        var maxDepth = maxRootDepthOverrideM ?? profile.DefaultRootDepthMaxM;

        return Math.Round(maxDepth * eval.RootDepthRatio, DepthDecimalPrecision, MidpointRounding.AwayFromZero);
    }

    /// <inheritdoc />
    public IReadOnlyList<CropGrowthProfile> GetSupportedCrops() => _profiles;

    /// <inheritdoc />
    public CropGrowthProfile GetCropProfile(string cropType)
    {
        if (string.IsNullOrWhiteSpace(cropType))
        {
            throw new ArgumentException("Crop type must be provided.", nameof(cropType));
        }

        var trimmed = cropType.Trim();
        if (trimmed.Length > MaxCropTypeLength)
        {
            throw new ArgumentException($"Crop type cannot exceed {MaxCropTypeLength} characters.", nameof(cropType));
        }

        if (_profilesByName.TryGetValue(trimmed, out var profile))
        {
            return profile;
        }

        var supported = string.Join(", ", _profiles.Select(p => p.CropType));
        throw new KeyNotFoundException(
            $"Unsupported crop type '{trimmed}'. Supported crops are: {supported}.");
    }

    /// <inheritdoc />
    public IReadOnlyList<DailyKcCurvePointDto> GenerateLifecycleCurve(string cropType, DateOnly plantingDate)
    {
        var profile = GetCropProfile(cropType);
        var points = new List<DailyKcCurvePointDto>(profile.TotalCycleDays + 1);

        for (int dap = 0; dap <= profile.TotalCycleDays; dap++)
        {
            var date = plantingDate.AddDays(dap);
            var eval = EvaluateCycleDay(profile, dap);
            var rootDepthM = Math.Round(profile.DefaultRootDepthMaxM * eval.RootDepthRatio, DepthDecimalPrecision, MidpointRounding.AwayFromZero);

            points.Add(new DailyKcCurvePointDto
            {
                DayAfterPlanting = dap,
                Date = date,
                Stage = eval.Stage,
                Kc = eval.Kc,
                EffectiveRootDepthM = rootDepthM
            });
        }

        return points;
    }

    /// <summary>
    /// Single unified evaluator for stage, within-stage progress, Kc(t), and RootDepthRatio(t)
    /// across all four FAO-56 boundaries so transitions never drift out of sync:
    ///   - day &lt; 0                      : PRE_PLANTING (Kc_ini, initial root ratio)
    ///   - 0 &lt;= day &lt; L_ini             : INITIAL plateau (Kc_ini)
    ///   - L_ini &lt;= day &lt; L_ini + L_dev : DEVELOPMENT linear ramp (Kc_ini -> Kc_mid, rootStart -> rootEnd)
    ///   - L_prev2 &lt;= day &lt; L_prev3     : MID_SEASON peak plateau (Kc_mid)
    ///   - L_prev3 &lt;= day &lt;= Harvest    : LATE_SEASON linear ramp (Kc_mid -> Kc_end, rootStart -> rootEnd)
    ///   - day &gt; Harvest                : POST_HARVEST / dormancy clamp (Kc_end)
    /// </summary>
    private static CycleDayEvaluation EvaluateCycleDay(CropGrowthProfile profile, int day)
    {
        var ini = profile.Stages.Initial;
        var dev = profile.Stages.Development;
        var mid = profile.Stages.MidSeason;
        var late = profile.Stages.LateSeason;

        int devStart = profile.DevelopmentStartDay;
        int midStart = profile.MidSeasonStartDay;
        int lateStart = profile.LateSeasonStartDay;
        int harvestDay = profile.TotalCycleDays;

        PhenologicalStage stage;
        decimal progressPct;
        decimal rawKc;
        decimal rawRootRatio;

        if (day < 0)
        {
            stage = PhenologicalStage.PrePlanting;
            progressPct = 0.0m;
            rawKc = ini.Kc;
            rawRootRatio = ini.RootDepthRatio;
        }
        else if (day < devStart)
        {
            stage = PhenologicalStage.Initial;
            progressPct = Math.Round((decimal)day / ini.DurationDays * 100m, 1, MidpointRounding.AwayFromZero);
            rawKc = ini.Kc;
            rawRootRatio = ini.RootDepthRatio;
        }
        else if (day < midStart)
        {
            decimal progress = (decimal)(day - devStart) / dev.DurationDays;
            stage = PhenologicalStage.Development;
            progressPct = Math.Round(progress * 100m, 1, MidpointRounding.AwayFromZero);
            rawKc = dev.KcStart + progress * (dev.KcEnd - dev.KcStart);
            rawRootRatio = dev.RootDepthRatioStart + progress * (dev.RootDepthRatioEnd - dev.RootDepthRatioStart);
        }
        else if (day < lateStart)
        {
            decimal progress = (decimal)(day - midStart) / mid.DurationDays;
            stage = PhenologicalStage.MidSeason;
            progressPct = Math.Round(progress * 100m, 1, MidpointRounding.AwayFromZero);
            rawKc = mid.Kc;
            rawRootRatio = mid.RootDepthRatio;
        }
        else if (day <= harvestDay)
        {
            decimal progress = (decimal)(day - lateStart) / late.DurationDays;
            stage = PhenologicalStage.LateSeason;
            progressPct = Math.Round(progress * 100m, 1, MidpointRounding.AwayFromZero);
            rawKc = late.KcStart - progress * (late.KcStart - late.KcEnd);
            rawRootRatio = late.RootDepthRatioStart + progress * (late.RootDepthRatioEnd - late.RootDepthRatioStart);
        }
        else
        {
            stage = PhenologicalStage.PostHarvest;
            progressPct = 100.0m;
            rawKc = late.KcEnd;
            rawRootRatio = late.RootDepthRatioEnd;
        }

        return new CycleDayEvaluation(
            stage,
            progressPct,
            Math.Round(rawKc, KcDecimalPrecision, MidpointRounding.AwayFromZero),
            Math.Round(rawRootRatio, KcDecimalPrecision, MidpointRounding.AwayFromZero));
    }

    /// <summary>
    /// Maps raw Days After Planting (DAP) into an effective seasonal cycle day.
    /// Annual crops use raw DAP directly.
    /// Perennial crops (e.g., Apple orchards) repeat their annual leaf-out cycle once targetDate reaches
    /// a full calendar year past plantingDate, safely handling leap days (Feb 29) and DateOnly.MaxValue.
    /// </summary>
    private static int ResolveEffectiveCycleDay(
        CropGrowthProfile profile,
        DateOnly plantingDate,
        DateOnly targetDate,
        int rawDap)
    {
        if (rawDap < 0 || !profile.IsPerennial)
        {
            return rawDap;
        }

        if (targetDate.Year == plantingDate.Year || plantingDate.Year == DateOnly.MaxValue.Year)
        {
            return rawDap;
        }

        var nextYearAnniversary = SafeAnniversaryDate(plantingDate.Year + 1, plantingDate.Month, plantingDate.Day);
        if (targetDate < nextYearAnniversary)
        {
            return rawDap;
        }

        var candidateAnniversary = SafeAnniversaryDate(targetDate.Year, plantingDate.Month, plantingDate.Day);
        if (candidateAnniversary > targetDate)
        {
            candidateAnniversary = SafeAnniversaryDate(targetDate.Year - 1, plantingDate.Month, plantingDate.Day);
        }

        return targetDate.DayNumber - candidateAnniversary.DayNumber;
    }

    private static DateOnly SafeAnniversaryDate(int year, int month, int day)
    {
        int clampedDay = Math.Min(day, DateTime.DaysInMonth(year, month));
        return new DateOnly(year, month, clampedDay);
    }

    private static void ValidateEt0(decimal et0Mm)
    {
        if (et0Mm < 0m || et0Mm > MaxValidEt0Mm)
        {
            throw new ArgumentOutOfRangeException(
                nameof(et0Mm),
                $"Reference evapotranspiration ET0 must be between 0 and {MaxValidEt0Mm} mm/day.");
        }
    }

    private static (IReadOnlyList<CropGrowthProfile> List, IReadOnlyDictionary<string, CropGrowthProfile> Map) BuildProfileLookup(
        IEnumerable<CropGrowthProfile> profiles,
        string sourceDescription)
    {
        var list = profiles.ToList();
        if (list.Count == 0)
        {
            throw new InvalidOperationException($"No crop profiles were defined in '{sourceDescription}'.");
        }

        var map = new Dictionary<string, CropGrowthProfile>(StringComparer.OrdinalIgnoreCase);
        foreach (var profile in list)
        {
            ValidateProfile(profile);
            if (!map.TryAdd(profile.CropType.Trim(), profile))
            {
                throw new InvalidOperationException(
                    $"Duplicate cropType '{profile.CropType}' found in '{sourceDescription}'.");
            }
        }

        return (list.AsReadOnly(), map);
    }

    private static string ResolveConfigPath(string? configuredPath)
    {
        var relativeOrAbsolute = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine("Configuration", "crop_growth_stages.json")
            : configuredPath;

        if (Path.IsPathRooted(relativeOrAbsolute))
        {
            return relativeOrAbsolute;
        }

        var baseDirCandidate = Path.Combine(AppContext.BaseDirectory, relativeOrAbsolute);
        if (File.Exists(baseDirCandidate))
        {
            return baseDirCandidate;
        }

        return Path.Combine(Directory.GetCurrentDirectory(), relativeOrAbsolute);
    }

    private static void ValidateProfile(CropGrowthProfile profile)
    {
        if (profile is null)
        {
            throw new InvalidOperationException("CropGrowthProfile entry cannot be null.");
        }

        if (string.IsNullOrWhiteSpace(profile.CropType))
        {
            throw new InvalidOperationException("CropGrowthProfile.CropType cannot be empty.");
        }

        if (profile.Stages is null ||
            profile.Stages.Initial is null ||
            profile.Stages.Development is null ||
            profile.Stages.MidSeason is null ||
            profile.Stages.LateSeason is null)
        {
            throw new InvalidOperationException(
                $"All four stages (initial, development, midSeason, lateSeason) must be defined for crop '{profile.CropType}'.");
        }

        var ini = profile.Stages.Initial;
        var dev = profile.Stages.Development;
        var mid = profile.Stages.MidSeason;
        var late = profile.Stages.LateSeason;

        if (ini.DurationDays <= 0 || dev.DurationDays <= 0 || mid.DurationDays <= 0 || late.DurationDays <= 0)
        {
            throw new InvalidOperationException(
                $"All four stage durations must be strictly positive for crop '{profile.CropType}'.");
        }

        if (ini.Kc <= 0m || mid.Kc <= 0m || late.KcEnd <= 0m)
        {
            throw new InvalidOperationException(
                $"All Kc values must be strictly positive for crop '{profile.CropType}'.");
        }

        if (dev.KcStart != ini.Kc || dev.KcEnd != mid.Kc || late.KcStart != mid.Kc)
        {
            throw new InvalidOperationException(
                $"Kc boundary mismatch detected for crop '{profile.CropType}': linear transitions must join smoothly with Initial ({ini.Kc}) and Mid-Season ({mid.Kc}) plateaus.");
        }

        ValidateRatio(ini.RootDepthRatio, "initial.rootDepthRatio", profile.CropType);
        ValidateRatio(dev.RootDepthRatioStart, "development.rootDepthRatioStart", profile.CropType);
        ValidateRatio(dev.RootDepthRatioEnd, "development.rootDepthRatioEnd", profile.CropType);
        ValidateRatio(mid.RootDepthRatio, "midSeason.rootDepthRatio", profile.CropType);
        ValidateRatio(late.RootDepthRatioStart, "lateSeason.rootDepthRatioStart", profile.CropType);
        ValidateRatio(late.RootDepthRatioEnd, "lateSeason.rootDepthRatioEnd", profile.CropType);

        if (dev.RootDepthRatioStart != ini.RootDepthRatio ||
            dev.RootDepthRatioEnd != mid.RootDepthRatio ||
            late.RootDepthRatioStart != mid.RootDepthRatio ||
            ini.RootDepthRatio > mid.RootDepthRatio)
        {
            throw new InvalidOperationException(
                $"RootDepthRatio boundary/monotonicity mismatch detected for crop '{profile.CropType}'.");
        }

        if (profile.DefaultRootDepthMaxM <= 0m)
        {
            throw new InvalidOperationException($"DefaultRootDepthMaxM must be positive for crop '{profile.CropType}'.");
        }

        if (profile.DefaultMadFraction <= 0m || profile.DefaultMadFraction > 1.0m)
        {
            throw new InvalidOperationException($"DefaultMadFraction must be in (0, 1] for crop '{profile.CropType}'.");
        }
    }

    private static void ValidateRatio(decimal ratio, string fieldName, string cropType)
    {
        if (ratio <= 0m || ratio > 1.0m)
        {
            throw new InvalidOperationException(
                $"{fieldName} must be in (0, 1] for crop '{cropType}', got {ratio}.");
        }
    }
}
