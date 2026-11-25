using System.Text.Json.Serialization;
using AgriTech.Api.Models;

namespace AgriTech.Api.Models.DTOs;

/// <summary>
/// Trigger source for an irrigation actuation event, serialized as exact UPPERCASE strings
/// per irrigation-api-contract.md.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<IrrigationTriggerType>))]
public enum IrrigationTriggerType
{
    [JsonStringEnumMemberName("AUTOMATED_DEFICIT")]
    AutomatedDeficit,

    [JsonStringEnumMemberName("MANUAL_OVERRIDE")]
    ManualOverride,

    [JsonStringEnumMemberName("SCHEDULED_RECIPE")]
    ScheduledRecipe
}

/// <summary>
/// Lifecycle status of an irrigation actuation event, serialized as exact UPPERCASE strings
/// per irrigation-api-contract.md.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<IrrigationEventStatus>))]
public enum IrrigationEventStatus
{
    [JsonStringEnumMemberName("PENDING")]
    Pending,

    [JsonStringEnumMemberName("IN_PROGRESS")]
    InProgress,

    [JsonStringEnumMemberName("COMPLETED")]
    Completed,

    [JsonStringEnumMemberName("ABORTED")]
    Aborted
}

/// <summary>
/// Shared IrrigationEvent representation matching irrigation-api-contract.md.
/// </summary>
public sealed class IrrigationEventDto
{
    public Guid Id { get; init; }
    public IrrigationTriggerType TriggerType { get; init; }
    public IrrigationEventStatus Status { get; init; }
    public DateTime ScheduledStart { get; init; }
    public DateTime? ActualStart { get; init; }
    public DateTime? CompletedAt { get; init; }
    public int DurationMinutes { get; init; }
    public decimal WaterVolumeLiters { get; init; }
}

/// <summary>
/// Exact response shape for GET /api/v1/parcels/{parcelId}/water-budget (irrigation-api-contract.md §1).
/// Moisture and soil capacity values are expressed in percent (e.g., 22.0), while madFraction stays a fraction (e.g., 0.50).
/// </summary>
public sealed class WaterBudgetDto
{
    public Guid ParcelId { get; init; }
    public string ParcelName { get; init; } = string.Empty;
    public string? CropName { get; init; }
    public string? SoilProfileId { get; init; }
    public string? SoilProfileName { get; init; }
    public decimal? FieldCapacityPct { get; init; }
    public decimal? WiltingPointPct { get; init; }
    public decimal? SaturationPct { get; init; }
    public decimal? MadFraction { get; init; }
    public decimal? CurrentMoisturePct { get; init; }
    public DateTime? LatestReadingAt { get; init; }
    public decimal? HoursUntilTrigger { get; init; }
    public decimal SystemFlowRateLpm { get; init; }
}

/// <summary>
/// Computed FAO-56 root-zone soil hydraulic retention capacities (TAW &amp; RAW) linked from soil_profiles.
/// </summary>
public sealed class SoilHydraulicCapacityDto
{
    public string SoilProfileId { get; init; } = string.Empty;
    public string SoilProfileName { get; init; } = string.Empty;
    public decimal FieldCapacityFraction { get; init; }
    public decimal WiltingPointFraction { get; init; }
    public decimal SaturationFraction { get; init; }
    public decimal MadFraction { get; init; }
    public decimal EffectiveRootDepthM { get; init; }

    /// <summary>
    /// Total Available Water: TAW = 1000 * (theta_FC - theta_WP) * Z_r (mm).
    /// </summary>
    public decimal TawMm { get; init; }

    /// <summary>
    /// Readily Available Water: RAW = p * TAW (mm).
    /// </summary>
    public decimal RawMm { get; init; }
}

/// <summary>
/// Precise gross/net refill volume and valve timing required to return root-zone moisture
/// to 100% of Field Capacity (D_r = 0).
/// </summary>
public sealed class IrrigationRefillPlanDto
{
    /// <summary>
    /// Net depth of water required in the root zone (= D_r, mm) to return to 100% Field Capacity.
    /// </summary>
    public decimal NetRefillDepthMm { get; init; }

    /// <summary>
    /// Net water volume delivered into the root zone (= D_r * Area_m2, Liters).
    /// </summary>
    public decimal NetVolumeLiters { get; init; }

    /// <summary>
    /// Gross water volume to pump accounting for system efficiency: (D_r * Area_m2) / eta (Liters).
    /// </summary>
    public decimal GrossVolumeLiters { get; init; }

    /// <summary>
    /// Effective depth delivered to the root zone when GrossVolumeLiters is applied at efficiency eta (mm).
    /// Matches NetRefillDepthMm so soil moisture returns precisely to 100% Field Capacity.
    /// </summary>
    public decimal EffectiveDeliveredMm { get; init; }

    /// <summary>
    /// Residual root-zone depletion after applying this irrigation refill (0.00 mm = 100% Field Capacity).
    /// </summary>
    public decimal PostIrrigationDepletionMm { get; init; }

    /// <summary>
    /// Volumetric soil moisture (%) after refill (= 100 * theta_FC).
    /// </summary>
    public decimal PostIrrigationMoisturePct { get; init; }

    /// <summary>
    /// Computed valve open duration in minutes (= GrossVolumeLiters / FlowRateLpm, minimum 1 min).
    /// </summary>
    public int DurationMinutes { get; init; }

    public decimal FlowRateLpm { get; init; }
    public decimal ApplicationEfficiency { get; init; }
    public decimal AreaSquareMeters { get; init; }
    public string Reason { get; init; } = IrrigationEventConstants.ReasonMadExceededDeficitRecovery;
}

/// <summary>
/// Input payload for stateless FAO-56 daily soil water balance evaluation (POST /api/v1/irrigation/evaluate).
/// </summary>
public sealed class DailyWaterBalanceRequestDto
{
    public string SoilProfileId { get; init; } = string.Empty;
    public decimal PreviousDepletionMm { get; init; }
    public decimal EtcMm { get; init; }
    public decimal PrecipitationMm { get; init; }
    public decimal IrrigationMm { get; init; }
    public decimal EffectiveRootDepthM { get; init; } = 0.60m;
    public decimal AreaHectares { get; init; } = 1.00m;
    public decimal IrrigationEfficiency { get; init; } = 0.88m;
    public decimal SystemFlowRateLpm { get; init; } = 100.00m;
    public decimal? MadFractionOverride { get; init; }
}

/// <summary>
/// Result of executing the FAO-56 daily soil water balance equation:
/// D_{r,t} = max(0, D_{r,t-1} + ET_{c,t} - P_{eff,t} - I_t).
/// </summary>
public sealed class DailyWaterBalanceResultDto
{
    public SoilHydraulicCapacityDto SoilCapacity { get; init; } = null!;
    public decimal PreviousDepletionMm { get; init; }
    public decimal EtcMm { get; init; }
    public decimal PrecipitationMm { get; init; }
    public decimal EffectivePrecipitationMm { get; init; }
    public decimal IrrigationAppliedMm { get; init; }
    public decimal DeepPercolationMm { get; init; }
    public decimal DepletionMm { get; init; }
    public decimal DepletionRatioOfRaw { get; init; }
    public decimal EstimatedMoisturePct { get; init; }
    public bool TriggerIrrigation { get; init; }
    public decimal? HoursUntilTrigger { get; init; }
    public IrrigationRefillPlanDto? RefillPlan { get; init; }
}

/// <summary>
/// Optional request overrides when triggering parcel-level water balance evaluation and automated scheduling.
/// </summary>
public sealed class ParcelIrrigationEvaluationRequestDto
{
    /// <summary>
    /// Target evaluation date (defaults to current UTC date).
    /// </summary>
    public DateOnly? TargetDate { get; init; }

    /// <summary>
    /// Optional previous day root-zone depletion D_{r,t-1} (mm).
    /// If omitted, derived automatically from the latest sensor_telemetry VWC reading (or 0 mm if none exists).
    /// </summary>
    public decimal? PreviousDepletionMm { get; init; }

    /// <summary>
    /// Optional simulated or measured precipitation P_t (mm). If omitted, loaded from weather_cache for TargetDate.
    /// </summary>
    public decimal? PrecipitationMmOverride { get; init; }

    /// <summary>
    /// Optional irrigation depth I_t (mm) already applied on TargetDate.
    /// </summary>
    public decimal IrrigationAppliedMm { get; init; } = 0.00m;

    /// <summary>
    /// Optional reference evapotranspiration ET0 (mm/day) override. If omitted, loaded from weather_cache.
    /// </summary>
    public decimal? Et0MmOverride { get; init; }

    /// <summary>
    /// Optional scheduled start timestamp (UTC) when an automated irrigation event is created. Defaults to UtcNow.
    /// </summary>
    public DateTime? ScheduledStartUtc { get; init; }
}

/// <summary>
/// Complete parcel evaluation and automated actuation scheduling response.
/// </summary>
public sealed class ParcelIrrigationEvaluationResponseDto
{
    public Guid ParcelId { get; init; }
    public string ParcelName { get; init; } = string.Empty;
    public string CropType { get; init; } = string.Empty;
    public DateOnly TargetDate { get; init; }
    public decimal Kc { get; init; }
    public decimal Et0Mm { get; init; }
    public DailyWaterBalanceResultDto WaterBalance { get; init; } = null!;
    public bool EventCreated { get; init; }
    public bool EventAlreadyActive { get; init; }
    public IrrigationEventDto? ScheduledEvent { get; init; }
}
