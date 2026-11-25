using AgriTech.Api.Models.DTOs;
using AgriTech.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgriTech.Api.Controllers;

/// <summary>
/// RESTful endpoints exposing the FAO-56 Root-Zone Water Deficit &amp; Actuation Trigger Engine (BACK-303).
/// Adheres to irrigation-api-contract.md conventions:
///   - camelCase JSON properties
///   - UPPERCASE enum strings (AUTOMATED_DEFICIT, MANUAL_OVERRIDE, SCHEDULED_RECIPE, PENDING, IN_PROGRESS, COMPLETED, ABORTED)
///   - ISO-8601 UTC timestamps
///   - RFC 7807 ProblemDetails error payloads
/// </summary>
[ApiController]
[Produces("application/json")]
public class IrrigationController : ControllerBase
{
    private const int MaxSoilProfileIdLength = 40;

    private readonly IIrrigationSchedulingEngine _schedulingEngine;

    public IrrigationController(IIrrigationSchedulingEngine schedulingEngine)
    {
        _schedulingEngine = schedulingEngine ?? throw new ArgumentNullException(nameof(schedulingEngine));
    }

    /// <summary>
    /// Returns the parcel water budget matching irrigation-api-contract.md §1
    /// (soil hydraulic constants in percent, madFraction as fraction, latest VWC reading, and hoursUntilTrigger).
    /// </summary>
    [HttpGet("api/v1/parcels/{parcelId:guid}/water-budget")]
    [ProducesResponseType(typeof(WaterBudgetDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WaterBudgetDto>> GetParcelWaterBudget(
        Guid parcelId,
        [FromQuery] DateOnly? targetDate = null,
        CancellationToken cancellationToken = default)
    {
        var budget = await _schedulingEngine.GetParcelWaterBudgetAsync(parcelId, targetDate, cancellationToken);
        if (budget is null)
        {
            return Problem(
                title: "Parcel Not Found",
                detail: $"Parcel with ID '{parcelId}' does not exist.",
                statusCode: StatusCodes.Status404NotFound);
        }

        return Ok(budget);
    }

    /// <summary>
    /// Lists scheduled and historical irrigation events for a registered parcel ordered newest first.
    /// </summary>
    [HttpGet("api/v1/parcels/{parcelId:guid}/irrigation/events")]
    [ProducesResponseType(typeof(IReadOnlyList<IrrigationEventDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<IrrigationEventDto>>> GetParcelIrrigationEvents(
        Guid parcelId,
        [FromQuery] int limit = IrrigationSchedulingEngine.DefaultEventsLimit,
        CancellationToken cancellationToken = default)
    {
        if (limit < 1 || limit > IrrigationSchedulingEngine.MaxEventsLimit)
        {
            return Problem(
                title: "Invalid Limit",
                detail: $"Query parameter 'limit' must be between 1 and {IrrigationSchedulingEngine.MaxEventsLimit}.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var events = await _schedulingEngine.GetParcelIrrigationEventsAsync(parcelId, limit, cancellationToken);
        if (events is null)
        {
            return Problem(
                title: "Parcel Not Found",
                detail: $"Parcel with ID '{parcelId}' does not exist.",
                statusCode: StatusCodes.Status404NotFound);
        }

        return Ok(events);
    }

    /// <summary>
    /// Evaluates the daily FAO-56 root-zone soil water balance for a registered parcel using its
    /// SoilProfile, Crop phenology (BACK-302), and WeatherCache (BACK-301), and automatically schedules
    /// a PENDING AUTOMATED_DEFICIT irrigation event when Dr &gt;= RAW.
    /// </summary>
    [HttpPost("api/v1/parcels/{parcelId:guid}/irrigation/evaluate")]
    [ProducesResponseType(typeof(ParcelIrrigationEvaluationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ParcelIrrigationEvaluationResponseDto>> EvaluateParcelIrrigation(
        Guid parcelId,
        [FromBody] ParcelIrrigationEvaluationRequestDto? request = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _schedulingEngine.EvaluateAndScheduleParcelAsync(parcelId, request, cancellationToken);
            if (result is null)
            {
                return Problem(
                    title: "Parcel Not Found",
                    detail: $"Parcel with ID '{parcelId}' does not exist.",
                    statusCode: StatusCodes.Status404NotFound);
            }

            return Ok(result);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return Problem(
                title: "Invalid Irrigation Evaluation Parameter",
                detail: ex.Message,
                statusCode: StatusCodes.Status400BadRequest);
        }
        catch (InvalidOperationException ex)
        {
            return Problem(
                title: "Unprocessable Parcel Configuration",
                detail: ex.Message,
                statusCode: StatusCodes.Status422UnprocessableEntity);
        }
        catch (KeyNotFoundException ex)
        {
            return Problem(
                title: "Unsupported Parcel Crop Type",
                detail: ex.Message,
                statusCode: StatusCodes.Status404NotFound);
        }
    }

    /// <summary>
    /// Stateless FAO-56 soil water balance simulation endpoint linking soil_profiles hydraulic constants
    /// to evaluate D_{r,t} = max(0, D_{r,t-1} + ET_c - P_{eff} - I) and compute exact refill volume without DB writes.
    /// </summary>
    [HttpPost("api/v1/irrigation/evaluate")]
    [ProducesResponseType(typeof(DailyWaterBalanceResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DailyWaterBalanceResultDto>> EvaluateWaterBalance(
        [FromBody] DailyWaterBalanceRequestDto? request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
        {
            return Problem(
                title: "Missing Request Body",
                detail: "A valid DailyWaterBalanceRequestDto payload is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (string.IsNullOrWhiteSpace(request.SoilProfileId) || request.SoilProfileId.Trim().Length > MaxSoilProfileIdLength)
        {
            return Problem(
                title: "Invalid Soil Profile ID",
                detail: $"Field 'soilProfileId' is required and cannot exceed {MaxSoilProfileIdLength} characters.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var soilProfile = await _schedulingEngine.GetSoilProfileAsync(request.SoilProfileId, cancellationToken);
        if (soilProfile is null)
        {
            return Problem(
                title: "Soil Profile Not Found",
                detail: $"Soil profile '{request.SoilProfileId.Trim()}' does not exist in soil_profiles.",
                statusCode: StatusCodes.Status404NotFound);
        }

        try
        {
            var result = _schedulingEngine.ComputeDailyWaterBalance(
                soilProfile,
                request.PreviousDepletionMm,
                request.EtcMm,
                request.PrecipitationMm,
                request.IrrigationMm,
                request.EffectiveRootDepthM,
                request.AreaHectares,
                request.IrrigationEfficiency,
                request.SystemFlowRateLpm,
                request.MadFractionOverride);

            return Ok(result);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return Problem(
                title: "Invalid Water Balance Parameter",
                detail: ex.Message,
                statusCode: StatusCodes.Status400BadRequest);
        }
    }
}
