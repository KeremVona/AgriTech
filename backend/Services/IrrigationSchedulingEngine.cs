using System.Collections.Concurrent;
using AgriTech.Api.Data;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AgriTech.Api.Services;

/// <summary>
/// Implements the FAO-56 Root-Zone Water Deficit &amp; Actuation Trigger Engine (BACK-303).
/// Combines soil_profiles hydraulic retention constants, BACK-302 dynamic crop coefficients/root depth,
/// and BACK-301 Open-Meteo meteorological inputs to calculate daily depletion and schedule valve runs.
/// </summary>
public class IrrigationSchedulingEngine : IIrrigationSchedulingEngine
{
    public const decimal SquareMetersPerHectare = 10_000m;
    public const decimal MaxRootDepthMeters = 10.0m;

    // Aligned strictly with PostgreSQL irrigation_events column precisions:
    //   deficit_depth_mm     NUMERIC(5, 2)  -> max 999.99
    //   flow_rate_lpm        NUMERIC(8, 2)  -> max 999,999.99
    //   water_volume_liters  NUMERIC(10, 2) -> max 99,999,999.99
    //   duration_minutes     INTEGER        -> capped at 30 days (43,200 min)
    public const decimal MaxDailyDepthMm = 999.99m;
    public const decimal MaxDeficitDepthMm = 999.99m;
    public const decimal MinAreaHectares = 0.0001m; // 1 m² minimum prevents areaSqm rounding to 0
    public const decimal MaxAreaHectares = 10_000.0m;
    public const decimal MinIrrigationEfficiency = 0.10m;
    public const decimal MinFlowRateLpm = 0.10m;
    public const decimal MaxFlowRateLpm = 999_999.99m;
    public const decimal MaxPersistableVolumeLiters = 99_999_999.99m;
    public const int MaxDurationMinutes = 43_200; // 30 days
    public const int DefaultEventsLimit = 50;
    public const int MaxEventsLimit = 500;

    // In-process per-parcel lock serializing automated scheduling checks to prevent TOCTOU double-scheduling
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> ParcelScheduleLocks = new();

    private readonly AgriTechDbContext _dbContext;
    private readonly ICropPhenologyService _phenologyService;
    private readonly ILogger<IrrigationSchedulingEngine> _logger;

    public IrrigationSchedulingEngine(
        AgriTechDbContext dbContext,
        ICropPhenologyService phenologyService,
        ILogger<IrrigationSchedulingEngine> logger)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _phenologyService = phenologyService ?? throw new ArgumentNullException(nameof(phenologyService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public SoilHydraulicCapacityDto CalculateHydraulicCapacity(
        SoilProfile soilProfile,
        decimal effectiveRootDepthM,
        decimal? madFractionOverride = null)
    {
        ValidateSoilProfile(soilProfile);
        ValidateRootDepth(effectiveRootDepthM);

        var madFraction = madFractionOverride ?? soilProfile.MadThresholdPct;
        if (madFraction <= 0m || madFraction > 1.0m)
        {
            throw new ArgumentOutOfRangeException(nameof(madFractionOverride), "MAD fraction must be in (0, 1].");
        }

        // TAW = 1000 * (theta_FC - theta_WP) * Z_r  (mm)
        var tawMm = Math.Round(
            1000m * (soilProfile.FieldCapacityPct - soilProfile.WiltingPointPct) * effectiveRootDepthM,
            2,
            MidpointRounding.AwayFromZero);

        // RAW = p * TAW  (mm)
        var rawMm = Math.Round(
            madFraction * tawMm,
            2,
            MidpointRounding.AwayFromZero);

        return new SoilHydraulicCapacityDto
        {
            SoilProfileId = soilProfile.Id,
            SoilProfileName = soilProfile.Name,
            FieldCapacityFraction = soilProfile.FieldCapacityPct,
            WiltingPointFraction = soilProfile.WiltingPointPct,
            SaturationFraction = soilProfile.SaturationPct,
            MadFraction = madFraction,
            EffectiveRootDepthM = Math.Round(effectiveRootDepthM, 3, MidpointRounding.AwayFromZero),
            TawMm = tawMm,
            RawMm = rawMm
        };
    }

    /// <inheritdoc />
    public DailyWaterBalanceResultDto ComputeDailyWaterBalance(
        SoilProfile soilProfile,
        decimal previousDepletionMm,
        decimal etcMm,
        decimal precipitationMm,
        decimal irrigationMm,
        decimal effectiveRootDepthM,
        decimal areaHectares,
        decimal irrigationEfficiency,
        decimal systemFlowRateLpm,
        decimal? madFractionOverride = null)
    {
        ValidateDepthRange(previousDepletionMm, nameof(previousDepletionMm));
        ValidateDepthRange(etcMm, nameof(etcMm));
        ValidateDepthRange(precipitationMm, nameof(precipitationMm));
        ValidateDepthRange(irrigationMm, nameof(irrigationMm));
        ValidateSystemParameters(areaHectares, irrigationEfficiency, systemFlowRateLpm);

        var capacity = CalculateHydraulicCapacity(soilProfile, effectiveRootDepthM, madFractionOverride);

        // FAO-56 Effective Precipitation: Peff = max(0, (P - 5) * 0.75)
        var effectivePrecipMm = WeatherCache.CalculateEffectivePrecipitation(precipitationMm);

        // Daily Soil Water Balance: Dr,raw = Dr,t-1 + ETc - Peff - I
        var rawDepletion = previousDepletionMm + etcMm - effectivePrecipMm - irrigationMm;

        // Deep percolation DP_t absorbs any excess moisture above Field Capacity (Dr,raw < 0)
        var deepPercolationMm = rawDepletion < 0m
            ? Math.Round(-rawDepletion, 2, MidpointRounding.AwayFromZero)
            : 0.00m;

        // Clamp Dr,t physically to [0, min(TAW, MaxDeficitDepthMm)] so DB NUMERIC(5,2) cannot overflow
        var maxDepletionBound = Math.Min(capacity.TawMm, MaxDeficitDepthMm);
        var depletionMm = Math.Round(
            Math.Clamp(rawDepletion, 0m, maxDepletionBound),
            2,
            MidpointRounding.AwayFromZero);

        // Convert root-zone depletion back to volumetric water content percentage (VWC %)
        var estimatedMoistureFraction = capacity.FieldCapacityFraction - (depletionMm / (1000m * effectiveRootDepthM));
        var estimatedMoisturePct = Math.Round(
            Math.Clamp(estimatedMoistureFraction, capacity.WiltingPointFraction, capacity.SaturationFraction) * 100m,
            2,
            MidpointRounding.AwayFromZero);

        // Actuation trigger condition: D_{r,t} >= RAW
        var triggerIrrigation = capacity.RawMm > 0m && depletionMm >= capacity.RawMm;
        var depletionRatioOfRaw = capacity.RawMm > 0m
            ? Math.Round(depletionMm / capacity.RawMm, 4, MidpointRounding.AwayFromZero)
            : 0.0000m;

        var hoursUntilTrigger = EstimateHoursUntilTrigger(depletionMm, capacity.RawMm, etcMm, effectivePrecipMm);

        IrrigationRefillPlanDto? refillPlan = triggerIrrigation
            ? CalculateRefillPlan(
                depletionMm,
                areaHectares,
                irrigationEfficiency,
                systemFlowRateLpm,
                capacity.FieldCapacityFraction,
                effectiveRootDepthM)
            : null;

        return new DailyWaterBalanceResultDto
        {
            SoilCapacity = capacity,
            PreviousDepletionMm = Math.Round(previousDepletionMm, 2, MidpointRounding.AwayFromZero),
            EtcMm = Math.Round(etcMm, 2, MidpointRounding.AwayFromZero),
            PrecipitationMm = Math.Round(precipitationMm, 2, MidpointRounding.AwayFromZero),
            EffectivePrecipitationMm = effectivePrecipMm,
            IrrigationAppliedMm = Math.Round(irrigationMm, 2, MidpointRounding.AwayFromZero),
            DeepPercolationMm = deepPercolationMm,
            DepletionMm = depletionMm,
            DepletionRatioOfRaw = depletionRatioOfRaw,
            EstimatedMoisturePct = estimatedMoisturePct,
            TriggerIrrigation = triggerIrrigation,
            HoursUntilTrigger = hoursUntilTrigger,
            RefillPlan = refillPlan
        };
    }

    /// <inheritdoc />
    public IrrigationRefillPlanDto CalculateRefillPlan(
        decimal deficitDepthMm,
        decimal areaHectares,
        decimal irrigationEfficiency,
        decimal systemFlowRateLpm,
        decimal fieldCapacityFraction,
        decimal effectiveRootDepthM)
    {
        if (deficitDepthMm <= 0m || deficitDepthMm > MaxDeficitDepthMm)
        {
            throw new ArgumentOutOfRangeException(nameof(deficitDepthMm), $"Deficit depth must be in (0, {MaxDeficitDepthMm}] mm.");
        }

        ValidateSystemParameters(areaHectares, irrigationEfficiency, systemFlowRateLpm);
        ValidateRootDepth(effectiveRootDepthM);

        if (fieldCapacityFraction <= 0m || fieldCapacityFraction >= 1.0m)
        {
            throw new ArgumentOutOfRangeException(nameof(fieldCapacityFraction), "Field capacity fraction must be in (0, 1).");
        }

        // 1 mm of water over 1 m² equals exactly 1 Liter; 1 ha = 10,000 m²
        var areaSqm = Math.Round(areaHectares * SquareMetersPerHectare, 2, MidpointRounding.AwayFromZero);
        var netRefillDepthMm = Math.Round(deficitDepthMm, 2, MidpointRounding.AwayFromZero);
        var netVolumeLiters = Math.Round(netRefillDepthMm * areaSqm, 2, MidpointRounding.AwayFromZero);

        // Gross Volume (L) = (Dr * Area_m2) / eta
        var grossVolumeLiters = Math.Round(
            (netRefillDepthMm * areaSqm) / irrigationEfficiency,
            2,
            MidpointRounding.AwayFromZero);

        if (grossVolumeLiters > MaxPersistableVolumeLiters)
        {
            throw new ArgumentOutOfRangeException(
                nameof(areaHectares),
                $"Calculated gross irrigation volume ({grossVolumeLiters:N2} L) exceeds maximum single-event capacity ({MaxPersistableVolumeLiters:N2} L). Split large parcels into smaller irrigation zones.");
        }

        // Verify effective root-zone recharge depth delivered by GrossVolumeLiters at efficiency eta
        var effectiveDeliveredMm = Math.Round(
            (grossVolumeLiters * irrigationEfficiency) / areaSqm,
            2,
            MidpointRounding.AwayFromZero);

        var postIrrigationDepletionMm = Math.Max(
            0.00m,
            Math.Round(netRefillDepthMm - effectiveDeliveredMm, 2, MidpointRounding.AwayFromZero));

        var postIrrigationMoisturePct = Math.Round(
            (fieldCapacityFraction - (postIrrigationDepletionMm / (1000m * effectiveRootDepthM))) * 100m,
            2,
            MidpointRounding.AwayFromZero);

        // Valve Open Duration (min) = Volume / FlowRate (checked against MaxDurationMinutes to prevent Int32 overflow)
        var rawDuration = Math.Round(grossVolumeLiters / systemFlowRateLpm, MidpointRounding.AwayFromZero);
        if (rawDuration > MaxDurationMinutes)
        {
            throw new ArgumentOutOfRangeException(
                nameof(systemFlowRateLpm),
                $"Calculated valve duration ({rawDuration:N0} min) exceeds maximum single-run duration ({MaxDurationMinutes:N0} min). Increase system flow rate or split into zones.");
        }

        var durationMinutes = Math.Max(1, (int)rawDuration);

        return new IrrigationRefillPlanDto
        {
            NetRefillDepthMm = netRefillDepthMm,
            NetVolumeLiters = netVolumeLiters,
            GrossVolumeLiters = grossVolumeLiters,
            EffectiveDeliveredMm = effectiveDeliveredMm,
            PostIrrigationDepletionMm = postIrrigationDepletionMm,
            PostIrrigationMoisturePct = postIrrigationMoisturePct,
            DurationMinutes = durationMinutes,
            FlowRateLpm = Math.Round(systemFlowRateLpm, 2, MidpointRounding.AwayFromZero),
            ApplicationEfficiency = Math.Round(irrigationEfficiency, 2, MidpointRounding.AwayFromZero),
            AreaSquareMeters = areaSqm,
            Reason = IrrigationEventConstants.ReasonMadExceededDeficitRecovery
        };
    }

    /// <inheritdoc />
    public decimal ComputeDepletionFromMoisturePct(
        SoilProfile soilProfile,
        decimal soilMoisturePct,
        decimal effectiveRootDepthM)
    {
        if (soilMoisturePct < 0m || soilMoisturePct > 100m)
        {
            throw new ArgumentOutOfRangeException(nameof(soilMoisturePct), "Soil moisture percentage must be in [0, 100].");
        }

        var capacity = CalculateHydraulicCapacity(soilProfile, effectiveRootDepthM);
        var moistureFraction = soilMoisturePct / 100m;
        var rawDepletion = 1000m * (capacity.FieldCapacityFraction - moistureFraction) * effectiveRootDepthM;

        return Math.Round(Math.Clamp(rawDepletion, 0m, capacity.TawMm), 2, MidpointRounding.AwayFromZero);
    }

    /// <inheritdoc />
    public decimal? EstimateHoursUntilTrigger(
        decimal currentDepletionMm,
        decimal rawMm,
        decimal dailyEtcMm,
        decimal dailyEffectivePrecipMm)
    {
        if (rawMm <= 0m)
        {
            return null;
        }

        if (currentDepletionMm >= rawMm)
        {
            return 0.0m;
        }

        var netDailyDryingMm = dailyEtcMm - dailyEffectivePrecipMm;
        if (netDailyDryingMm <= 0m)
        {
            return null;
        }

        var remainingBufferMm = rawMm - currentDepletionMm;
        var hours = Math.Round((remainingBufferMm / netDailyDryingMm) * 24m, 1, MidpointRounding.AwayFromZero);
        return Math.Max(0.1m, hours);
    }

    /// <inheritdoc />
    public async Task<SoilProfile?> GetSoilProfileAsync(string soilProfileId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(soilProfileId))
        {
            return null;
        }

        var normalizedId = soilProfileId.Trim().ToLowerInvariant();
        return await _dbContext.SoilProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == normalizedId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<ParcelIrrigationEvaluationResponseDto?> EvaluateAndScheduleParcelAsync(
        Guid parcelId,
        ParcelIrrigationEvaluationRequestDto? request = null,
        CancellationToken cancellationToken = default)
    {
        request ??= new ParcelIrrigationEvaluationRequestDto();
        var targetDate = request.TargetDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        if (request.ScheduledStartUtc.HasValue)
        {
            var normalizedStart = EnsureUtc(request.ScheduledStartUtc.Value);
            var nowUtc = DateTime.UtcNow;
            if (normalizedStart < nowUtc.AddDays(-1) || normalizedStart > nowUtc.AddDays(30))
            {
                throw new ArgumentOutOfRangeException(
                    nameof(request.ScheduledStartUtc),
                    "ScheduledStartUtc must be within 1 day in the past and 30 days in the future.");
            }
        }

        // Project scalar columns only — avoids over-fetching PostGIS BoundaryGeom
        var parcel = await _dbContext.Parcels
            .AsNoTracking()
            .Where(p => p.Id == parcelId)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.AreaHectares,
                p.PlantingDate,
                p.IrrigationEfficiency,
                p.SystemFlowRateLpm,
                CropName = p.Crop.CommonName,
                p.Crop.DefaultRootDepthMaxM,
                SoilProfile = p.SoilProfile
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (parcel is null)
        {
            return null;
        }

        if (parcel.AreaHectares < MinAreaHectares)
        {
            throw new InvalidOperationException(
                $"Parcel '{parcelId}' has invalid area_hectares ({parcel.AreaHectares}). A computed parcel area >= {MinAreaHectares} ha is required before scheduling irrigation.");
        }

        // 1. Meteorological inputs from BACK-301 weather_cache (unless overridden in request)
        var weather = await _dbContext.WeatherCaches
            .AsNoTracking()
            .Where(w => w.ParcelId == parcelId && w.ForecastDate == targetDate)
            .Select(w => new { w.Et0Mm, w.PrecipitationMm })
            .FirstOrDefaultAsync(cancellationToken);

        var et0Mm = request.Et0MmOverride ?? weather?.Et0Mm ?? 0.00m;
        var precipitationMm = request.PrecipitationMmOverride ?? weather?.PrecipitationMm ?? 0.00m;

        // 2. Phenology, canonical ET0 validation [0, 100], ETc = Kc * ET0, and dynamic Z_r from BACK-302
        var phenology = _phenologyService.AssessCropPhenology(
            parcel.CropName,
            parcel.PlantingDate,
            targetDate,
            et0Mm: et0Mm,
            maxRootDepthOverrideM: parcel.DefaultRootDepthMaxM);

        var etcMm = phenology.EtcMm ?? 0.00m;

        // 3. Initial root-zone depletion D_{r,t-1}
        decimal previousDepletionMm;
        if (request.PreviousDepletionMm.HasValue)
        {
            previousDepletionMm = request.PreviousDepletionMm.Value;
        }
        else
        {
            var latestReading = await _dbContext.SensorTelemetries
                .AsNoTracking()
                .Where(t => t.ParcelId == parcelId)
                .OrderByDescending(t => t.Timestamp)
                .Select(t => (decimal?)t.SoilMoisturePct)
                .FirstOrDefaultAsync(cancellationToken);

            previousDepletionMm = latestReading.HasValue
                ? ComputeDepletionFromMoisturePct(parcel.SoilProfile, latestReading.Value, phenology.EffectiveRootDepthM)
                : 0.00m;
        }

        // 4. Execute daily soil water balance & actuation evaluation
        var waterBalance = ComputeDailyWaterBalance(
            parcel.SoilProfile,
            previousDepletionMm,
            etcMm,
            precipitationMm,
            request.IrrigationAppliedMm,
            phenology.EffectiveRootDepthM,
            parcel.AreaHectares,
            parcel.IrrigationEfficiency,
            parcel.SystemFlowRateLpm);

        // 5. Schedule automated irrigation record when D_r >= RAW (serialized per parcel + 23505 fallback)
        bool eventCreated = false;
        bool eventAlreadyActive = false;
        IrrigationEventDto? scheduledEventDto = null;

        if (waterBalance.TriggerIrrigation && waterBalance.RefillPlan is not null)
        {
            var parcelLock = ParcelScheduleLocks.GetOrAdd(parcelId, _ => new SemaphoreSlim(1, 1));
            await parcelLock.WaitAsync(cancellationToken);
            try
            {
                var existingActive = await FindActiveEventAsync(parcelId, cancellationToken);
                if (existingActive is not null)
                {
                    eventAlreadyActive = true;
                    scheduledEventDto = MapToDto(existingActive);
                    _logger.LogInformation(
                        "Parcel {ParcelId} exceeded RAW (Dr={Dr}mm >= RAW={Raw}mm), but active event {EventId} ({Status}) already exists; skipping duplicate creation.",
                        parcelId, waterBalance.DepletionMm, waterBalance.SoilCapacity.RawMm, existingActive.Id, existingActive.Status);
                }
                else
                {
                    var refill = waterBalance.RefillPlan;
                    var scheduledStart = request.ScheduledStartUtc.HasValue
                        ? EnsureUtc(request.ScheduledStartUtc.Value)
                        : DateTime.UtcNow;

                    var newEvent = new IrrigationEvent
                    {
                        Id = Guid.NewGuid(),
                        ParcelId = parcelId,
                        TriggerType = IrrigationEventConstants.TriggerAutomatedDeficit,
                        Status = IrrigationEventConstants.StatusPending,
                        DeficitDepthMm = waterBalance.DepletionMm,
                        ScheduledStart = scheduledStart,
                        ActualStart = null,
                        CompletedAt = null,
                        DurationMinutes = refill.DurationMinutes,
                        WaterVolumeLiters = refill.GrossVolumeLiters,
                        FlowRateLpm = refill.FlowRateLpm,
                        Reason = refill.Reason,
                        TriggeredByUserId = null,
                        MadeAt = DateTime.UtcNow
                    };

                    _dbContext.IrrigationEvents.Add(newEvent);

                    try
                    {
                        await _dbContext.SaveChangesAsync(cancellationToken);
                        eventCreated = true;
                        scheduledEventDto = MapToDto(newEvent);

                        _logger.LogInformation(
                            "Automated irrigation event {EventId} scheduled for parcel {ParcelId}: Dr={Dr}mm >= RAW={Raw}mm -> GrossVolume={Volume}L, Duration={Duration}min.",
                            newEvent.Id, parcelId, newEvent.DeficitDepthMm, waterBalance.SoilCapacity.RawMm, newEvent.WaterVolumeLiters, newEvent.DurationMinutes);
                    }
                    catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
                    {
                        _dbContext.Entry(newEvent).State = EntityState.Detached;
                        var winner = await FindActiveEventAsync(parcelId, cancellationToken);
                        if (winner is null)
                        {
                            throw;
                        }

                        eventAlreadyActive = true;
                        scheduledEventDto = MapToDto(winner);
                    }
                }
            }
            finally
            {
                parcelLock.Release();
            }
        }

        return new ParcelIrrigationEvaluationResponseDto
        {
            ParcelId = parcel.Id,
            ParcelName = parcel.Name,
            CropType = parcel.CropName,
            TargetDate = targetDate,
            Kc = phenology.Kc,
            Et0Mm = et0Mm,
            WaterBalance = waterBalance,
            EventCreated = eventCreated,
            EventAlreadyActive = eventAlreadyActive,
            ScheduledEvent = scheduledEventDto
        };
    }

    /// <inheritdoc />
    public async Task<WaterBudgetDto?> GetParcelWaterBudgetAsync(
        Guid parcelId,
        DateOnly? targetDate = null,
        CancellationToken cancellationToken = default)
    {
        var effectiveDate = targetDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var parcel = await _dbContext.Parcels
            .AsNoTracking()
            .Where(p => p.Id == parcelId)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.PlantingDate,
                p.SystemFlowRateLpm,
                CropName = p.Crop != null ? p.Crop.CommonName : null,
                CropMaxRootDepthM = p.Crop != null ? (decimal?)p.Crop.DefaultRootDepthMaxM : null,
                SoilProfile = p.SoilProfile
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (parcel is null)
        {
            return null;
        }

        var latestReading = await _dbContext.SensorTelemetries
            .AsNoTracking()
            .Where(t => t.ParcelId == parcelId)
            .OrderByDescending(t => t.Timestamp)
            .Select(t => new { t.SoilMoisturePct, t.Timestamp })
            .FirstOrDefaultAsync(cancellationToken);

        decimal? hoursUntilTrigger = null;
        if (latestReading is not null && parcel.SoilProfile is not null && !string.IsNullOrWhiteSpace(parcel.CropName))
        {
            var weather = await _dbContext.WeatherCaches
                .AsNoTracking()
                .Where(w => w.ParcelId == parcelId && w.ForecastDate == effectiveDate)
                .Select(w => new { w.Et0Mm, w.EffectivePrecipitationMm })
                .FirstOrDefaultAsync(cancellationToken);

            if (weather is not null)
            {
                try
                {
                    var phenology = _phenologyService.AssessCropPhenology(
                        parcel.CropName,
                        parcel.PlantingDate,
                        effectiveDate,
                        et0Mm: weather.Et0Mm,
                        maxRootDepthOverrideM: parcel.CropMaxRootDepthM);

                    var capacity = CalculateHydraulicCapacity(parcel.SoilProfile, phenology.EffectiveRootDepthM);
                    var currentDepletion = ComputeDepletionFromMoisturePct(
                        parcel.SoilProfile,
                        latestReading.SoilMoisturePct,
                        phenology.EffectiveRootDepthM);

                    hoursUntilTrigger = EstimateHoursUntilTrigger(
                        currentDepletion,
                        capacity.RawMm,
                        phenology.EtcMm ?? 0m,
                        weather.EffectivePrecipitationMm);
                }
                catch (Exception ex) when (ex is KeyNotFoundException or ArgumentOutOfRangeException)
                {
                    // Corrupted sensor VWC reading or unsupported crop variety: degrade gracefully so gauge still renders
                    _logger.LogWarning(ex, "Could not compute hoursUntilTrigger for parcel {ParcelId}; returning null.", parcelId);
                }
            }
        }

        var hasSoil = parcel.SoilProfile is not null;
        return new WaterBudgetDto
        {
            ParcelId = parcel.Id,
            ParcelName = parcel.Name,
            CropName = parcel.CropName,
            SoilProfileId = hasSoil ? parcel.SoilProfile!.Id : null,
            SoilProfileName = hasSoil ? parcel.SoilProfile!.Name : null,
            // Per irrigation-api-contract.md: soil capacities in percent (e.g., 22.0), madFraction stays a fraction (e.g., 0.50)
            FieldCapacityPct = hasSoil ? Math.Round(parcel.SoilProfile!.FieldCapacityPct * 100m, 1, MidpointRounding.AwayFromZero) : null,
            WiltingPointPct = hasSoil ? Math.Round(parcel.SoilProfile!.WiltingPointPct * 100m, 1, MidpointRounding.AwayFromZero) : null,
            SaturationPct = hasSoil ? Math.Round(parcel.SoilProfile!.SaturationPct * 100m, 1, MidpointRounding.AwayFromZero) : null,
            MadFraction = hasSoil ? parcel.SoilProfile!.MadThresholdPct : null,
            CurrentMoisturePct = latestReading?.SoilMoisturePct,
            LatestReadingAt = latestReading is not null ? EnsureUtc(latestReading.Timestamp) : null,
            HoursUntilTrigger = hoursUntilTrigger,
            SystemFlowRateLpm = parcel.SystemFlowRateLpm
        };
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<IrrigationEventDto>?> GetParcelIrrigationEventsAsync(
        Guid parcelId,
        int limit = DefaultEventsLimit,
        CancellationToken cancellationToken = default)
    {
        if (limit < 1 || limit > MaxEventsLimit)
        {
            throw new ArgumentOutOfRangeException(nameof(limit), $"Limit must be between 1 and {MaxEventsLimit}.");
        }

        var parcelExists = await _dbContext.Parcels
            .AsNoTracking()
            .AnyAsync(p => p.Id == parcelId, cancellationToken);

        if (!parcelExists)
        {
            return null;
        }

        var rows = await _dbContext.IrrigationEvents
            .AsNoTracking()
            .Where(e => e.ParcelId == parcelId)
            .OrderByDescending(e => e.ScheduledStart)
            .Take(limit)
            .Select(e => new
            {
                e.Id,
                e.TriggerType,
                e.Status,
                e.ScheduledStart,
                e.ActualStart,
                e.CompletedAt,
                e.DurationMinutes,
                e.WaterVolumeLiters
            })
            .ToListAsync(cancellationToken);

        return rows.Select(e => new IrrigationEventDto
        {
            Id = e.Id,
            TriggerType = ParseTriggerType(e.TriggerType),
            Status = ParseStatus(e.Status),
            ScheduledStart = EnsureUtc(e.ScheduledStart),
            ActualStart = e.ActualStart.HasValue ? EnsureUtc(e.ActualStart.Value) : null,
            CompletedAt = e.CompletedAt.HasValue ? EnsureUtc(e.CompletedAt.Value) : null,
            DurationMinutes = e.DurationMinutes,
            WaterVolumeLiters = e.WaterVolumeLiters
        }).ToList();
    }

    internal static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    internal static IrrigationEventDto MapToDto(IrrigationEvent entity)
    {
        return new IrrigationEventDto
        {
            Id = entity.Id,
            TriggerType = ParseTriggerType(entity.TriggerType),
            Status = ParseStatus(entity.Status),
            ScheduledStart = EnsureUtc(entity.ScheduledStart),
            ActualStart = entity.ActualStart.HasValue ? EnsureUtc(entity.ActualStart.Value) : null,
            CompletedAt = entity.CompletedAt.HasValue ? EnsureUtc(entity.CompletedAt.Value) : null,
            DurationMinutes = entity.DurationMinutes,
            WaterVolumeLiters = entity.WaterVolumeLiters
        };
    }

    private Task<IrrigationEvent?> FindActiveEventAsync(Guid parcelId, CancellationToken cancellationToken)
    {
        return _dbContext.IrrigationEvents
            .AsNoTracking()
            .Where(e => e.ParcelId == parcelId &&
                        (e.Status == IrrigationEventConstants.StatusPending ||
                         e.Status == IrrigationEventConstants.StatusInProgress))
            .OrderByDescending(e => e.ScheduledStart)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static IrrigationTriggerType ParseTriggerType(string value) => value?.ToUpperInvariant() switch
    {
        IrrigationEventConstants.TriggerAutomatedDeficit => IrrigationTriggerType.AutomatedDeficit,
        IrrigationEventConstants.TriggerManualOverride => IrrigationTriggerType.ManualOverride,
        IrrigationEventConstants.TriggerScheduledRecipe => IrrigationTriggerType.ScheduledRecipe,
        _ => throw new InvalidOperationException($"Unrecognized irrigation_events.trigger_type value '{value}'.")
    };

    private static IrrigationEventStatus ParseStatus(string value) => value?.ToUpperInvariant() switch
    {
        IrrigationEventConstants.StatusPending => IrrigationEventStatus.Pending,
        IrrigationEventConstants.StatusInProgress => IrrigationEventStatus.InProgress,
        IrrigationEventConstants.StatusCompleted => IrrigationEventStatus.Completed,
        IrrigationEventConstants.StatusAborted => IrrigationEventStatus.Aborted,
        _ => throw new InvalidOperationException($"Unrecognized irrigation_events.status value '{value}'.")
    };

    private static void ValidateSoilProfile(SoilProfile soilProfile)
    {
        if (soilProfile is null)
        {
            throw new ArgumentNullException(nameof(soilProfile));
        }

        if (soilProfile.FieldCapacityPct <= 0m || soilProfile.FieldCapacityPct >= 1.0m)
        {
            throw new ArgumentOutOfRangeException(
                nameof(soilProfile),
                $"SoilProfile '{soilProfile.Id}' field_capacity_pct must be a volumetric fraction in (0, 1).");
        }

        if (soilProfile.WiltingPointPct < 0m || soilProfile.WiltingPointPct >= soilProfile.FieldCapacityPct)
        {
            throw new ArgumentOutOfRangeException(
                nameof(soilProfile),
                $"SoilProfile '{soilProfile.Id}' wilting_point_pct ({soilProfile.WiltingPointPct}) must be in [0, field_capacity_pct).");
        }

        if (soilProfile.SaturationPct < soilProfile.FieldCapacityPct || soilProfile.SaturationPct > 1.0m)
        {
            throw new ArgumentOutOfRangeException(
                nameof(soilProfile),
                $"SoilProfile '{soilProfile.Id}' saturation_pct ({soilProfile.SaturationPct}) must be in [field_capacity_pct, 1].");
        }
    }

    private static void ValidateRootDepth(decimal effectiveRootDepthM)
    {
        if (effectiveRootDepthM <= 0m || effectiveRootDepthM > MaxRootDepthMeters)
        {
            throw new ArgumentOutOfRangeException(
                nameof(effectiveRootDepthM),
                $"Effective root depth must be in (0, {MaxRootDepthMeters}] meters.");
        }
    }

    private static void ValidateDepthRange(decimal depthMm, string paramName)
    {
        if (depthMm < 0m || depthMm > MaxDailyDepthMm)
        {
            throw new ArgumentOutOfRangeException(
                paramName,
                $"Depth parameter '{paramName}' must be in [0, {MaxDailyDepthMm}] mm.");
        }
    }

    private static void ValidateSystemParameters(
        decimal areaHectares,
        decimal irrigationEfficiency,
        decimal systemFlowRateLpm)
    {
        if (areaHectares < MinAreaHectares || areaHectares > MaxAreaHectares)
        {
            throw new ArgumentOutOfRangeException(
                nameof(areaHectares),
                $"Area must be in [{MinAreaHectares}, {MaxAreaHectares}] hectares.");
        }

        if (irrigationEfficiency < MinIrrigationEfficiency || irrigationEfficiency > 1.0m)
        {
            throw new ArgumentOutOfRangeException(
                nameof(irrigationEfficiency),
                $"Irrigation application efficiency must be in [{MinIrrigationEfficiency}, 1.0].");
        }

        if (systemFlowRateLpm < MinFlowRateLpm || systemFlowRateLpm > MaxFlowRateLpm)
        {
            throw new ArgumentOutOfRangeException(
                nameof(systemFlowRateLpm),
                $"System flow rate must be in [{MinFlowRateLpm}, {MaxFlowRateLpm}] L/min.");
        }
    }
}
