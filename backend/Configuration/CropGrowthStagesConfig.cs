using System.Text.Json.Serialization;

namespace AgriTech.Api.Configuration;

/// <summary>
/// Options controlling where the static FAO-56 crop phenology configuration file is loaded from.
/// </summary>
public class CropPhenologyOptions
{
    public const string SectionName = "CropPhenology";

    /// <summary>
    /// Path (relative to application base directory or absolute) to crop_growth_stages.json.
    /// </summary>
    public string ConfigFilePath { get; set; } = Path.Combine("Configuration", "crop_growth_stages.json");
}

/// <summary>
/// Immutable root schema for backend/Configuration/crop_growth_stages.json.
/// </summary>
public sealed class CropGrowthStagesDocument
{
    [JsonPropertyName("schemaVersion")]
    public string SchemaVersion { get; init; } = "1.0";

    [JsonPropertyName("reference")]
    public string Reference { get; init; } = string.Empty;

    [JsonPropertyName("crops")]
    public IReadOnlyList<CropGrowthProfile> Crops { get; init; } = Array.Empty<CropGrowthProfile>();
}

/// <summary>
/// Immutable FAO-56 phenological profile for a supported crop variety (safe to share from a Singleton service).
/// </summary>
public sealed class CropGrowthProfile
{
    [JsonPropertyName("cropId")]
    public Guid CropId { get; init; }

    [JsonPropertyName("cropType")]
    public string CropType { get; init; } = string.Empty;

    [JsonPropertyName("scientificName")]
    public string ScientificName { get; init; } = string.Empty;

    [JsonPropertyName("isPerennial")]
    public bool IsPerennial { get; init; }

    [JsonPropertyName("defaultRootDepthMaxM")]
    public decimal DefaultRootDepthMaxM { get; init; } = 0.60m;

    [JsonPropertyName("defaultMadFraction")]
    public decimal DefaultMadFraction { get; init; } = 0.50m;

    [JsonPropertyName("stages")]
    public CropStagesDefinition Stages { get; init; } = null!;

    /// <summary>
    /// DAP boundary where Development stage begins (= L_ini).
    /// </summary>
    [JsonIgnore]
    public int DevelopmentStartDay => Stages.Initial.DurationDays;

    /// <summary>
    /// DAP boundary where Mid-Season plateau begins (= L_ini + L_dev).
    /// </summary>
    [JsonIgnore]
    public int MidSeasonStartDay => Stages.Initial.DurationDays + Stages.Development.DurationDays;

    /// <summary>
    /// DAP boundary where Late-Season senescence begins (= L_ini + L_dev + L_mid).
    /// </summary>
    [JsonIgnore]
    public int LateSeasonStartDay => Stages.Initial.DurationDays + Stages.Development.DurationDays + Stages.MidSeason.DurationDays;

    /// <summary>
    /// Total duration of the full four-stage FAO-56 growing cycle in days (= Harvest DAP).
    /// </summary>
    [JsonIgnore]
    public int TotalCycleDays => LateSeasonStartDay + Stages.LateSeason.DurationDays;
}

/// <summary>
/// Immutable four-stage FAO-56 definition: Initial, Development, Mid-Season, and Late-Season.
/// </summary>
public sealed class CropStagesDefinition
{
    [JsonPropertyName("initial")]
    public PlateauStageDefinition Initial { get; init; } = null!;

    [JsonPropertyName("development")]
    public LinearStageDefinition Development { get; init; } = null!;

    [JsonPropertyName("midSeason")]
    public PlateauStageDefinition MidSeason { get; init; } = null!;

    [JsonPropertyName("lateSeason")]
    public LinearStageDefinition LateSeason { get; init; } = null!;
}

/// <summary>
/// Immutable constant-Kc plateau stage (Initial or Mid-Season).
/// </summary>
public sealed class PlateauStageDefinition
{
    [JsonPropertyName("durationDays")]
    public int DurationDays { get; init; }

    [JsonPropertyName("kc")]
    public decimal Kc { get; init; }

    [JsonPropertyName("rootDepthRatio")]
    public decimal RootDepthRatio { get; init; }

    [JsonPropertyName("description")]
    public string Description { get; init; } = string.Empty;
}

/// <summary>
/// Immutable linearly interpolated transition stage (Development or Late-Season).
/// </summary>
public sealed class LinearStageDefinition
{
    [JsonPropertyName("durationDays")]
    public int DurationDays { get; init; }

    [JsonPropertyName("kcStart")]
    public decimal KcStart { get; init; }

    [JsonPropertyName("kcEnd")]
    public decimal KcEnd { get; init; }

    [JsonPropertyName("rootDepthRatioStart")]
    public decimal RootDepthRatioStart { get; init; }

    [JsonPropertyName("rootDepthRatioEnd")]
    public decimal RootDepthRatioEnd { get; init; }

    [JsonPropertyName("description")]
    public string Description { get; init; } = string.Empty;
}
