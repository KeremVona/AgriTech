using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Services;

/// <summary>
/// FAO-56 Root-Zone Soil Water Balance &amp; Automated Actuation Trigger Engine (BACK-303).
/// Computes soil hydraulic capacities (TAW/RAW) from soil_profiles, advances daily depletion
/// D_{r,t} = max(0, D_{r,t-1} + ET_{c,t} - P_{eff,t} - I_t), and schedules automated irrigation
/// events sized precisely to return soil moisture to 100% of Field Capacity when D_r >= RAW.
/// </summary>
public interface IIrrigationSchedulingEngine
{
    /// <summary>
    /// Computes parcel-specific Total Available Water (TAW) and Readily Available Water (RAW)
    /// from soil_profiles hydraulic parameters and effective rooting depth Z_r.
    /// </summary>
    SoilHydraulicCapacityDto CalculateHydraulicCapacity(
        SoilProfile soilProfile,
        decimal effectiveRootDepthM,
        decimal? madFractionOverride = null);

    /// <summary>
    /// Executes the FAO-56 daily soil water balance equation:
    ///   D_{r,t} = max(0, D_{r,t-1} + ET_{c,t} - P_{eff,t} - I_t)
    /// where P_{eff,t} = max(0, (P_t - 5) * 0.75), evaluates D_{r,t} >= RAW,
    /// and generates a precise refill plan when irrigation is triggered.
    /// </summary>
    DailyWaterBalanceResultDto ComputeDailyWaterBalance(
        SoilProfile soilProfile,
        decimal previousDepletionMm,
        decimal etcMm,
        decimal precipitationMm,
        decimal irrigationMm,
        decimal effectiveRootDepthM,
        decimal areaHectares,
        decimal irrigationEfficiency,
        decimal systemFlowRateLpm,
        decimal? madFractionOverride = null);

    /// <summary>
    /// Computes gross/net irrigation volume (Liters) and valve open duration (minutes)
    /// required to eliminate deficitDepthMm and return soil moisture to 100% of Field Capacity.
    /// </summary>
    IrrigationRefillPlanDto CalculateRefillPlan(
        decimal deficitDepthMm,
        decimal areaHectares,
        decimal irrigationEfficiency,
        decimal systemFlowRateLpm,
        decimal fieldCapacityFraction,
        decimal effectiveRootDepthM);

    /// <summary>
    /// Converts an observed volumetric soil moisture percentage (VWC %, e.g. 16.0)
    /// into root-zone water depletion D_r (mm) bounded to [0, TAW].
    /// </summary>
    decimal ComputeDepletionFromMoisturePct(
        SoilProfile soilProfile,
        decimal soilMoisturePct,
        decimal effectiveRootDepthM);

    /// <summary>
    /// Estimates hours remaining until depletion reaches RAW at the given daily ETc and effective rainfall.
    /// Returns 0.0 when trigger threshold is already met, or null if soil is not actively drying.
    /// </summary>
    decimal? EstimateHoursUntilTrigger(
        decimal currentDepletionMm,
        decimal rawMm,
        decimal dailyEtcMm,
        decimal dailyEffectivePrecipMm);

    /// <summary>
    /// Looks up a SoilProfile by ID from the soil_profiles reference table.
    /// </summary>
    Task<SoilProfile?> GetSoilProfileAsync(string soilProfileId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Evaluates the daily soil water balance for a registered parcel by joining its SoilProfile,
    /// Crop phenology (BACK-302), WeatherCache (BACK-301), and SensorTelemetry, and persists an
    /// AUTOMATED_DEFICIT IrrigationEvent when D_r >= RAW (idempotent against existing active runs).
    /// Returns null if the parcel does not exist.
    /// </summary>
    Task<ParcelIrrigationEvaluationResponseDto?> EvaluateAndScheduleParcelAsync(
        Guid parcelId,
        ParcelIrrigationEvaluationRequestDto? request = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Builds the WaterBudget response matching irrigation-api-contract.md §1 for a registered parcel.
    /// Returns null if the parcel does not exist.
    /// </summary>
    Task<WaterBudgetDto?> GetParcelWaterBudgetAsync(
        Guid parcelId,
        DateOnly? targetDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists scheduled and historical IrrigationEvent records for a parcel ordered newest first,
    /// capped to the specified limit (1..500). Returns null if the parcel does not exist.
    /// </summary>
    Task<IReadOnlyList<IrrigationEventDto>?> GetParcelIrrigationEventsAsync(
        Guid parcelId,
        int limit = 50,
        CancellationToken cancellationToken = default);
}
