using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgriTech.Api.Controllers;

/// <summary>
/// RESTful endpoints exposing the FAO-56 Dynamic Crop Coefficient (Kc) &amp; Phenology Engine (BACK-302).
/// Adheres to irrigation-api-contract.md conventions:
///   - camelCase JSON properties
///   - UPPERCASE enum strings (PRE_PLANTING, INITIAL, DEVELOPMENT, MID_SEASON, LATE_SEASON, POST_HARVEST)
///   - ISO-8601 UTC timestamps
///   - RFC 7807 ProblemDetails error payloads (always populated with 'detail')
/// </summary>
[ApiController]
[Produces("application/json")]
public class PhenologyController : ControllerBase
{
    private readonly ICropPhenologyService _phenologyService;
    private readonly IParcelPhenologyQueryService _parcelPhenologyQueryService;

    public PhenologyController(
        ICropPhenologyService phenologyService,
        IParcelPhenologyQueryService parcelPhenologyQueryService)
    {
        _phenologyService = phenologyService ?? throw new ArgumentNullException(nameof(phenologyService));
        _parcelPhenologyQueryService = parcelPhenologyQueryService ?? throw new ArgumentNullException(nameof(parcelPhenologyQueryService));
    }

    /// <summary>
    /// Returns the static FAO-56 crop growth stage catalog (Tomato, Corn, Potato, Apple)
    /// loaded from crop_growth_stages.json.
    /// </summary>
    [HttpGet("api/v1/phenology/crops")]
    [ProducesResponseType(typeof(IReadOnlyList<CropPhenologyCatalogItemDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<CropPhenologyCatalogItemDto>> GetSupportedCrops()
    {
        var items = _phenologyService.GetSupportedCrops()
            .Select(c => new CropPhenologyCatalogItemDto
            {
                CropId = c.CropId,
                CropType = c.CropType,
                ScientificName = c.ScientificName,
                IsPerennial = c.IsPerennial,
                DefaultRootDepthMaxM = c.DefaultRootDepthMaxM,
                DefaultMadFraction = c.DefaultMadFraction,
                TotalCycleDays = c.TotalCycleDays,
                Stages = c.Stages
            })
            .ToList();

        return Ok(items);
    }

    /// <summary>
    /// Evaluates the FAO-56 crop coefficient Kc(t), current phenological stage, effective rooting depth,
    /// and optional crop evapotranspiration (ETc = Kc * ET0) for a given crop type and dates.
    /// </summary>
    [HttpGet("api/v1/phenology/kc")]
    [ProducesResponseType(typeof(PhenologyAssessmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public ActionResult<PhenologyAssessmentDto> CalculateKc(
        [FromQuery] string? cropType = null,
        [FromQuery] DateOnly? plantingDate = null,
        [FromQuery] DateOnly? targetDate = null,
        [FromQuery] decimal? et0Mm = null)
    {
        if (string.IsNullOrWhiteSpace(cropType))
        {
            return Problem(
                title: "Invalid Crop Type",
                detail: "Query parameter 'cropType' is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (cropType.Trim().Length > CropPhenologyService.MaxCropTypeLength)
        {
            return Problem(
                title: "Invalid Crop Type",
                detail: $"Query parameter 'cropType' cannot exceed {CropPhenologyService.MaxCropTypeLength} characters.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (!plantingDate.HasValue)
        {
            return Problem(
                title: "Missing Planting Date",
                detail: "Query parameter 'plantingDate' (YYYY-MM-DD) is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (et0Mm.HasValue && (et0Mm.Value < 0m || et0Mm.Value > CropPhenologyService.MaxValidEt0Mm))
        {
            return Problem(
                title: "Invalid Reference Evapotranspiration",
                detail: $"Query parameter 'et0Mm' must be between 0 and {CropPhenologyService.MaxValidEt0Mm} mm/day.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var effectiveTargetDate = targetDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            var assessment = _phenologyService.AssessCropPhenology(
                cropType,
                plantingDate.Value,
                effectiveTargetDate,
                et0Mm);

            return Ok(assessment);
        }
        catch (KeyNotFoundException ex)
        {
            return Problem(
                title: "Unsupported Crop Type",
                detail: ex.Message,
                statusCode: StatusCodes.Status404NotFound);
        }
    }

    /// <summary>
    /// Generates the complete day-by-day Kc and rooting depth lifecycle curve from DAP 0 through harvest.
    /// </summary>
    [HttpGet("api/v1/phenology/curve")]
    [ProducesResponseType(typeof(IReadOnlyList<DailyKcCurvePointDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public ActionResult<IReadOnlyList<DailyKcCurvePointDto>> GetLifecycleCurve(
        [FromQuery] string? cropType = null,
        [FromQuery] DateOnly? plantingDate = null)
    {
        if (string.IsNullOrWhiteSpace(cropType))
        {
            return Problem(
                title: "Invalid Crop Type",
                detail: "Query parameter 'cropType' is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (cropType.Trim().Length > CropPhenologyService.MaxCropTypeLength)
        {
            return Problem(
                title: "Invalid Crop Type",
                detail: $"Query parameter 'cropType' cannot exceed {CropPhenologyService.MaxCropTypeLength} characters.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var startDate = plantingDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            var curve = _phenologyService.GenerateLifecycleCurve(cropType, startDate);
            return Ok(curve);
        }
        catch (KeyNotFoundException ex)
        {
            return Problem(
                title: "Unsupported Crop Type",
                detail: ex.Message,
                statusCode: StatusCodes.Status404NotFound);
        }
    }

    /// <summary>
    /// Computes the live FAO-56 phenological assessment for a registered parcel by joining its crop variety,
    /// planting date, and cached Open-Meteo ET0 (from BACK-301 weather_cache) to derive daily ETc = Kc * ET0.
    /// </summary>
    [HttpGet("api/v1/parcels/{parcelId:guid}/phenology")]
    [ProducesResponseType(typeof(ParcelPhenologyResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ParcelPhenologyResponseDto>> GetParcelPhenology(
        Guid parcelId,
        [FromQuery] DateOnly? targetDate = null,
        CancellationToken cancellationToken = default)
    {
        var effectiveTargetDate = targetDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        try
        {
            var response = await _parcelPhenologyQueryService.GetParcelPhenologyAsync(
                parcelId,
                effectiveTargetDate,
                cancellationToken);

            if (response is null)
            {
                return Problem(
                    title: "Parcel Not Found",
                    detail: $"Parcel with ID '{parcelId}' does not exist.",
                    statusCode: StatusCodes.Status404NotFound);
            }

            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return Problem(
                title: "Unsupported Parcel Crop Type",
                detail: ex.Message,
                statusCode: StatusCodes.Status404NotFound);
        }
    }
}
