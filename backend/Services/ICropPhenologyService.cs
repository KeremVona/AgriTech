using AgriTech.Api.Configuration;
using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Services;

/// <summary>
/// FAO-56 Phenological Development Stage Engine (BACK-302).
/// Computes dynamic crop coefficients (Kc), crop evapotranspiration (ETc), and effective rooting depth
/// across Initial, Development, Mid-Season, and Late-Season growth stages.
/// </summary>
public interface ICropPhenologyService
{
    /// <summary>
    /// Calculates the dynamic FAO-56 crop coefficient Kc(t) for a crop type on the given target date.
    /// Guarantees smooth piecewise-linear continuity across L_ini -> L_dev -> L_mid -> L_late transitions.
    /// </summary>
    /// <param name="cropType">Crop common name (e.g., "Tomato", "Corn", "Potato", "Apple"), case-insensitive.</param>
    /// <param name="plantingDate">Planting date (or annual budbreak/leaf-out date for perennial orchards).</param>
    /// <param name="targetDate">Target date for which to compute Kc.</param>
    /// <returns>Dynamic crop coefficient Kc rounded to 4 decimal places.</returns>
    decimal CalculateCurrentKc(string cropType, DateOnly plantingDate, DateOnly targetDate);

    /// <summary>
    /// Computes the full phenological assessment (Kc, stage, DAP, stage progress, effective root depth,
    /// and optional ETc = Kc * ET0) for a crop on a target date.
    /// </summary>
    PhenologyAssessmentDto AssessCropPhenology(
        string cropType,
        DateOnly plantingDate,
        DateOnly targetDate,
        decimal? et0Mm = null,
        decimal? maxRootDepthOverrideM = null);

    /// <summary>
    /// Computes crop evapotranspiration: ETc = Kc(t) * ET0 (mm/day).
    /// </summary>
    decimal CalculateCropEvapotranspiration(
        string cropType,
        DateOnly plantingDate,
        DateOnly targetDate,
        decimal et0Mm);

    /// <summary>
    /// Computes the dynamic effective rooting depth Z_r(t) in meters, linearly expanding from initial
    /// rooting ratio to full maturity depth across the Development stage.
    /// </summary>
    decimal CalculateEffectiveRootDepthMeters(
        string cropType,
        DateOnly plantingDate,
        DateOnly targetDate,
        decimal? maxRootDepthOverrideM = null);

    /// <summary>
    /// Returns all supported crop growth stage profiles loaded from crop_growth_stages.json.
    /// </summary>
    IReadOnlyList<CropGrowthProfile> GetSupportedCrops();

    /// <summary>
    /// Looks up a configured crop growth profile by case-insensitive crop type name.
    /// </summary>
    CropGrowthProfile GetCropProfile(string cropType);

    /// <summary>
    /// Generates the complete day-by-day Kc and effective rooting depth curve from DAP 0 through Harvest.
    /// </summary>
    IReadOnlyList<DailyKcCurvePointDto> GenerateLifecycleCurve(string cropType, DateOnly plantingDate);
}
