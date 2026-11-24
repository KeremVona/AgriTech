using System.Text.Json.Serialization;
using AgriTech.Api.Configuration;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// Phenological stage identifier serialized as exact UPPERCASE strings per irrigation-api-contract.md.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<PhenologicalStage>))]
public enum PhenologicalStage
{
    [JsonStringEnumMemberName("PRE_PLANTING")]
    PrePlanting,

    [JsonStringEnumMemberName("INITIAL")]
    Initial,

    [JsonStringEnumMemberName("DEVELOPMENT")]
    Development,

    [JsonStringEnumMemberName("MID_SEASON")]
    MidSeason,

    [JsonStringEnumMemberName("LATE_SEASON")]
    LateSeason,

    [JsonStringEnumMemberName("POST_HARVEST")]
    PostHarvest
}

/// <summary>
/// Full phenological evaluation output for a crop on a given target date.
/// Uses camelCase JSON property names and UPPERCASE enum strings per irrigation-api-contract.md.
/// </summary>
public class PhenologyAssessmentDto
{
    public string CropType { get; init; } = string.Empty;
    public string ScientificName { get; init; } = string.Empty;
    public bool IsPerennial { get; init; }
    public DateOnly PlantingDate { get; init; }
    public DateOnly TargetDate { get; init; }
    public int DaysAfterPlanting { get; init; }
    public int EffectiveCycleDay { get; init; }
    public int TotalCycleDays { get; init; }
    public PhenologicalStage Stage { get; init; }
    public decimal StageProgressPct { get; init; }
    public decimal Kc { get; init; }
    public decimal RootDepthRatio { get; init; }
    public decimal EffectiveRootDepthM { get; init; }
    public decimal DefaultMadFraction { get; init; }
    public decimal? Et0Mm { get; init; }
    public decimal? EtcMm { get; init; }
}

/// <summary>
/// Single point along the day-by-day FAO-56 Kc curve for a crop lifecycle.
/// </summary>
public class DailyKcCurvePointDto
{
    public int DayAfterPlanting { get; init; }
    public DateOnly Date { get; init; }
    public PhenologicalStage Stage { get; init; }
    public decimal Kc { get; init; }
    public decimal EffectiveRootDepthM { get; init; }
}

/// <summary>
/// Catalog entry describing a crop's static FAO-56 stage parameters.
/// </summary>
public class CropPhenologyCatalogItemDto
{
    public Guid CropId { get; init; }
    public string CropType { get; init; } = string.Empty;
    public string ScientificName { get; init; } = string.Empty;
    public bool IsPerennial { get; init; }
    public decimal DefaultRootDepthMaxM { get; init; }
    public decimal DefaultMadFraction { get; init; }
    public int TotalCycleDays { get; init; }
    public CropStagesDefinition Stages { get; init; } = new();
}

/// <summary>
/// Live phenology and crop evapotranspiration (ETc) response for a specific parcel.
/// </summary>
public class ParcelPhenologyResponseDto
{
    public Guid ParcelId { get; init; }
    public string ParcelName { get; init; } = string.Empty;
    public DateTime CalculatedAtUtc { get; init; }
    public DateOnly? WeatherSourceDate { get; init; }
    public PhenologyAssessmentDto Assessment { get; init; } = null!;
}
