namespace AgriTech.Api.Models;

/// <summary>
/// Standardized UPPERCASE constants for irrigation_events.trigger_type, status, and reason columns,
/// matching COMPLETE_DATABASE_SCHEMA.md and irrigation-api-contract.md.
/// </summary>
public static class IrrigationEventConstants
{
    public const string TriggerAutomatedDeficit = "AUTOMATED_DEFICIT";
    public const string TriggerManualOverride = "MANUAL_OVERRIDE";
    public const string TriggerScheduledRecipe = "SCHEDULED_RECIPE";

    public const string StatusPending = "PENDING";
    public const string StatusInProgress = "IN_PROGRESS";
    public const string StatusCompleted = "COMPLETED";
    public const string StatusAborted = "ABORTED";

    public const string ReasonMadExceededDeficitRecovery = "MAD_EXCEEDED_DEFICIT_RECOVERY";
}

/// <summary>
/// Entity mapped to the 'irrigation_events' table (Module 6: Meteorology &amp; FAO-56 Irrigation Engine).
/// Tracks the complete valve actuation lifecycle from MAD deficit trigger to completion or abort.
/// </summary>
public class IrrigationEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ParcelId { get; set; }
    public Parcel Parcel { get; set; } = null!;

    /// <summary>
    /// Trigger origin: AUTOMATED_DEFICIT, MANUAL_OVERRIDE, or SCHEDULED_RECIPE.
    /// </summary>
    public string TriggerType { get; set; } = IrrigationEventConstants.TriggerAutomatedDeficit;

    /// <summary>
    /// Lifecycle status: PENDING, IN_PROGRESS, COMPLETED, or ABORTED.
    /// </summary>
    public string Status { get; set; } = IrrigationEventConstants.StatusPending;

    /// <summary>
    /// Calculated root-zone water depletion D_r (mm) at trigger time.
    /// </summary>
    public decimal DeficitDepthMm { get; set; }

    /// <summary>
    /// Scheduled UTC valve opening timestamp.
    /// </summary>
    public DateTime ScheduledStart { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Actual UTC valve actuation start timestamp (null while PENDING).
    /// </summary>
    public DateTime? ActualStart { get; set; }

    /// <summary>
    /// Actual UTC valve closure timestamp (set on COMPLETED or ABORTED).
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Planned or actual valve open duration in minutes.
    /// </summary>
    public int DurationMinutes { get; set; }

    /// <summary>
    /// Gross water volume (Liters) required to return soil moisture to 100% of Field Capacity.
    /// </summary>
    public decimal WaterVolumeLiters { get; set; }

    /// <summary>
    /// Configured system flow rate (L/min) used to calculate duration.
    /// </summary>
    public decimal FlowRateLpm { get; set; }

    /// <summary>
    /// Diagnostic reason code (e.g., MAD_EXCEEDED_DEFICIT_RECOVERY).
    /// </summary>
    public string? Reason { get; set; }

    /// <summary>
    /// Optional operator user ID if initiated manually.
    /// </summary>
    public Guid? TriggeredByUserId { get; set; }
    public User? TriggeredByUser { get; set; }

    /// <summary>
    /// Record creation timestamp in UTC.
    /// </summary>
    public DateTime MadeAt { get; set; } = DateTime.UtcNow;
}
