using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Features;
using Npgsql;

namespace AgriTech.Api.Controllers;

/// <summary>
/// RESTful controller for parcel lifecycle management within farm fields.
///
/// Endpoints:
///   GET    /api/v1/fields/{fieldId}/parcels  - List parcels as GeoJSON FeatureCollection
///   POST   /api/v1/parcels                   - Create parcel (with overlap + containment checks)
///   PUT    /api/v1/parcels/{id}              - Update parcel (area + BBOX recalculation)
///   DELETE /api/v1/parcels/{id}              - Delete parcel (cascade via FK rules)
///
/// Spatial integrity pipeline (POST and PUT):
///   1. [ValidPolygon] — N≥4 coordinates, ring closed, polygon IsValid  → HTTP 400
///   2. Parent field existence check                                      → HTTP 404
///   3. Spatial containment — ST_Covers(field.geom, parcel.geom)          → HTTP 422
///   4. Overlap detection   — fn_check_parcel_overlap (BACK-203)          → HTTP 409
///   5. DB write → triggers recalculate area_hectares                     → HTTP 201/200
/// </summary>
[ApiController]
[Produces("application/json")]
public class ParcelsController : ControllerBase
{
    private readonly AgriTechDbContext _db;
    private readonly ILogger<ParcelsController> _logger;

    public ParcelsController(AgriTechDbContext db, ILogger<ParcelsController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/fields/{fieldId}/parcels
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns all parcels belonging to a specific field as an RFC 7946 GeoJSON FeatureCollection.
    ///
    /// Each Feature contains:
    ///   • geometry  — Polygon coordinates ready for Leaflet / Mapbox / OpenLayers layers
    ///   • properties — parcel metadata (id, name, crop, area_hectares, planting_date, kc_current, …)
    ///
    /// Returns 404 if the field does not exist.
    /// Returns an empty FeatureCollection (features: []) if the field has no parcels yet.
    /// </summary>
    [HttpGet("api/v1/fields/{fieldId:guid}/parcels")]
    [ProducesResponseType(typeof(FeatureCollection), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FeatureCollection>> GetParcelsByField(
        Guid fieldId,
        CancellationToken cancellationToken)
    {
        var fieldExists = await _db.Fields.AnyAsync(f => f.Id == fieldId, cancellationToken);
        if (!fieldExists)
            return NotFound(new { message = $"Field '{fieldId}' was not found." });

        var parcels = await _db.Parcels
            .Where(p => p.FieldId == fieldId)
            .Include(p => p.Crop)
            .Include(p => p.Field)
            .Include(p => p.SoilProfile)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Use the GeoJsonSerializationExtensions (BACK-204) to produce a compliant FeatureCollection
        return Ok(parcels.ToGeoJsonFeatureCollection());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/parcels
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a new parcel within a farm field.
    ///
    /// Full validation pipeline:
    ///   1. ModelState ([ValidPolygon], [Required], ranges) — HTTP 400 on failure.
    ///   2. Parent field existence — HTTP 404 if not found.
    ///   3. Crop and SoilProfile FK existence — HTTP 422 if missing.
    ///   4. Spatial containment check using NTS ST_Covers equivalent — HTTP 422 if outside field.
    ///   5. Overlap detection via fn_check_parcel_overlap (BACK-203) — HTTP 409 if collision.
    ///   6. EF Core SaveChanges → trg_enforce_parcel_integrity DB trigger (BACK-203) fires
    ///      as a last-resort guard, translating PostgreSQL RAISE EXCEPTION → HTTP 400/422.
    ///   7. DB trigger calculate_parcel_area computes area_hectares automatically.
    ///   8. Returns 201 Created with the full ParcelResponseDto including updated BBOX.
    /// </summary>
    [HttpPost("api/v1/parcels")]
    [ProducesResponseType(typeof(ParcelResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ParcelResponseDto>> CreateParcel(
        [FromBody] CreateParcelRequest request,
        CancellationToken cancellationToken)
    {
        // --- 2. Parent field existence ---
        var field = await _db.Fields
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FieldId, cancellationToken);

        if (field is null)
            return NotFound(new { message = $"Field '{request.FieldId}' was not found." });

        // --- 3. FK lookups for Crop and SoilProfile ---
        var cropExists = await _db.Crops.AnyAsync(c => c.Id == request.CropId, cancellationToken);
        if (!cropExists)
            return UnprocessableEntity(new { message = $"Crop '{request.CropId}' was not found." });

        var soilExists = await _db.SoilProfiles.AnyAsync(s => s.Id == request.SoilProfileId, cancellationToken);
        if (!soilExists)
            return UnprocessableEntity(new { message = $"SoilProfile '{request.SoilProfileId}' was not found." });

        // --- 4. Spatial containment check ---
        // The parcel must lie entirely inside the parent field boundary.
        // We use NetTopologySuite's Covers() which mirrors PostGIS ST_Covers semantics:
        //   covers = contains + allows boundary touching
        if (field.BoundaryGeom is not null && !field.BoundaryGeom.Covers(request.BoundaryGeom))
        {
            return UnprocessableEntity(new
            {
                message = "Parcel boundary is not fully contained within the parent field boundary. " +
                          "Ensure all parcel coordinates lie inside the field polygon, " +
                          "including boundary-touching points.",
                field_id = field.Id,
                field_name = field.Name
            });
        }

        // --- 5. Overlap detection via BACK-203 stored procedure ---
        var overlaps = await _db.CheckParcelOverlapAsync(
            request.FieldId,
            request.BoundaryGeom,
            excludeParcelId: null,
            cancellationToken);

        if (overlaps.Count > 0)
        {
            var conflict = overlaps[0];
            return Conflict(new
            {
                message = $"Candidate parcel overlaps with existing parcel '{conflict.ConflictingParcelName}' " +
                          $"(id: {conflict.ConflictingParcelId}) by {conflict.OverlapAreaSqm} m². " +
                          $"Adjust the parcel boundary so it does not intersect any existing parcels.",
                conflicting_parcel_id   = conflict.ConflictingParcelId,
                conflicting_parcel_name = conflict.ConflictingParcelName,
                overlap_area_sqm        = conflict.OverlapAreaSqm
            });
        }

        // --- 6. Persist ---
        var parcel = new Parcel
        {
            FieldId             = request.FieldId,
            CropId              = request.CropId,
            SoilProfileId       = request.SoilProfileId,
            Name                = request.Name,
            BoundaryGeom        = request.BoundaryGeom,
            PlantingDate        = request.PlantingDate,
            IrrigationMethod    = request.IrrigationMethod,
            SystemFlowRateLpm   = request.SystemFlowRateLpm,
            IrrigationEfficiency = request.IrrigationEfficiency,
            MadeAt              = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow
        };

        _db.Parcels.Add(parcel);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsPostgresRaiseException(ex, out var pgMessage))
        {
            // trg_enforce_parcel_integrity fired — translate the RAISE EXCEPTION message to HTTP 400
            return BadRequest(new { message = pgMessage });
        }
        catch (DbUpdateException ex) when (IsPostgresCheckViolation(ex))
        {
            return BadRequest(new
            {
                message = "The parcel polygon geometry is invalid according to PostGIS ST_IsValid.",
                detail  = ExtractPostgresMessage(ex)
            });
        }

        // Reload to get DB-computed area_hectares (trigger wrote it after INSERT)
        await _db.Entry(parcel).ReloadAsync(cancellationToken);

        // Load navigation properties for the response DTO
        await _db.Entry(parcel).Reference(p => p.Field).LoadAsync(cancellationToken);
        await _db.Entry(parcel).Reference(p => p.Crop).LoadAsync(cancellationToken);
        await _db.Entry(parcel).Reference(p => p.SoilProfile).LoadAsync(cancellationToken);

        var dto = parcel.ToResponseDto();

        _logger.LogInformation(
            "Parcel {ParcelId} '{Name}' created in field {FieldId} — {Area} ha",
            parcel.Id, parcel.Name, parcel.FieldId, parcel.AreaHectares);

        return CreatedAtAction(nameof(GetParcelById), new { id = parcel.Id }, dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/parcels/{id}
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns a single parcel by its primary key.
    /// Includes the full boundary polygon, computed bounding box, and area.
    /// </summary>
    [HttpGet("api/v1/parcels/{id:guid}")]
    [ProducesResponseType(typeof(ParcelResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ParcelResponseDto>> GetParcelById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var parcel = await _db.Parcels
            .Include(p => p.Field)
            .Include(p => p.Crop)
            .Include(p => p.SoilProfile)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (parcel is null)
            return NotFound(new { message = $"Parcel '{id}' was not found." });

        return Ok(parcel.ToResponseDto());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/v1/parcels/{id}
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Updates a parcel's metadata and/or spatial boundary.
    ///
    /// BBOX and area recalculation (Acceptance Criterion 2):
    ///   When BoundaryGeom is included in the request body:
    ///   • The overlap check is re-run, excluding the current parcel (excludeParcelId = id).
    ///   • After SaveChanges the PostgreSQL calculate_parcel_area() trigger fires and
    ///     rewrites area_hectares.
    ///   • The response DTO includes the freshly reloaded area_hectares and the
    ///     new bounding_box computed from the updated polygon's EnvelopeInternal.
    ///
    /// Only explicitly supplied (non-null) fields are updated — partial update semantics.
    /// </summary>
    [HttpPut("api/v1/parcels/{id:guid}")]
    [ProducesResponseType(typeof(ParcelResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ParcelResponseDto>> UpdateParcel(
        Guid id,
        [FromBody] UpdateParcelRequest request,
        CancellationToken cancellationToken)
    {
        var parcel = await _db.Parcels
            .Include(p => p.Field)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (parcel is null)
            return NotFound(new { message = $"Parcel '{id}' was not found." });

        // --- Apply non-null scalar updates ---
        if (request.Name is not null)             parcel.Name = request.Name;
        if (request.CropId.HasValue)              parcel.CropId = request.CropId.Value;
        if (request.SoilProfileId is not null)    parcel.SoilProfileId = request.SoilProfileId;
        if (request.PlantingDate.HasValue)        parcel.PlantingDate = request.PlantingDate.Value;
        if (request.KcCurrent.HasValue)           parcel.KcCurrent = request.KcCurrent.Value;
        if (request.IrrigationMethod is not null) parcel.IrrigationMethod = request.IrrigationMethod;
        if (request.SystemFlowRateLpm.HasValue)   parcel.SystemFlowRateLpm = request.SystemFlowRateLpm.Value;
        if (request.IrrigationEfficiency.HasValue) parcel.IrrigationEfficiency = request.IrrigationEfficiency.Value;

        // --- Geometry update path ---
        if (request.BoundaryGeom is not null)
        {
            // Spatial containment re-check against parent field
            var fieldGeom = parcel.Field?.BoundaryGeom;
            if (fieldGeom is not null && !fieldGeom.Covers(request.BoundaryGeom))
            {
                return UnprocessableEntity(new
                {
                    message = "Updated parcel boundary extends outside the parent field boundary.",
                    field_id   = parcel.FieldId,
                    field_name = parcel.Field?.Name
                });
            }

            // Overlap re-check, explicitly excluding this parcel itself
            var overlaps = await _db.CheckParcelOverlapAsync(
                parcel.FieldId,
                request.BoundaryGeom,
                excludeParcelId: id,
                cancellationToken);

            if (overlaps.Count > 0)
            {
                var conflict = overlaps[0];
                return Conflict(new
                {
                    message = $"Updated boundary overlaps existing parcel '{conflict.ConflictingParcelName}' " +
                              $"by {conflict.OverlapAreaSqm} m².",
                    conflicting_parcel_id   = conflict.ConflictingParcelId,
                    conflicting_parcel_name = conflict.ConflictingParcelName,
                    overlap_area_sqm        = conflict.OverlapAreaSqm
                });
            }

            parcel.BoundaryGeom = request.BoundaryGeom;
        }

        parcel.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsPostgresRaiseException(ex, out var pgMessage))
        {
            return BadRequest(new { message = pgMessage });
        }
        catch (DbUpdateException ex) when (IsPostgresCheckViolation(ex))
        {
            return BadRequest(new
            {
                message = "The updated polygon geometry is invalid according to PostGIS ST_IsValid.",
                detail  = ExtractPostgresMessage(ex)
            });
        }

        // Reload after save so the DB-computed area_hectares is fresh
        await _db.Entry(parcel).ReloadAsync(cancellationToken);
        await _db.Entry(parcel).Reference(p => p.Field).LoadAsync(cancellationToken);
        await _db.Entry(parcel).Reference(p => p.Crop).LoadAsync(cancellationToken);
        await _db.Entry(parcel).Reference(p => p.SoilProfile).LoadAsync(cancellationToken);

        _logger.LogInformation(
            "Parcel {ParcelId} '{Name}' updated — area: {Area} ha",
            parcel.Id, parcel.Name, parcel.AreaHectares);

        return Ok(parcel.ToResponseDto());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/v1/parcels/{id}
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Deletes a parcel by its primary key.
    ///
    /// Cascade behavior enforced by PostgreSQL FK rules (BACK-202):
    ///   • SensorNodes with parcel_id = id → CASCADE deleted automatically.
    ///   • CropScans with parcel_id = id → SET NULL (scans preserved for ML re-training).
    ///
    /// Returns 204 No Content on success; 404 if not found.
    /// </summary>
    [HttpDelete("api/v1/parcels/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteParcel(
        Guid id,
        CancellationToken cancellationToken)
    {
        var parcel = await _db.Parcels.FindAsync([id], cancellationToken);

        if (parcel is null)
            return NotFound(new { message = $"Parcel '{id}' was not found." });

        _db.Parcels.Remove(parcel);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Parcel {ParcelId} deleted", id);

        return NoContent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Detects whether a DbUpdateException wraps a PostgreSQL RAISE EXCEPTION from our triggers.
    /// SqlState P0001 = raise_exception (user-defined PL/pgSQL RAISE without a code).
    /// </summary>
    private static bool IsPostgresRaiseException(DbUpdateException ex, out string message)
    {
        var pg = ex.InnerException as PostgresException;
        if (pg?.SqlState == "P0001")
        {
            message = pg.MessageText ?? "Database integrity rule violated.";
            return true;
        }
        message = string.Empty;
        return false;
    }

    private static bool IsPostgresCheckViolation(DbUpdateException ex)
    {
        var pg = ex.InnerException as PostgresException;
        return pg?.SqlState == "23514"; // check_violation
    }

    private static string? ExtractPostgresMessage(DbUpdateException ex)
        => (ex.InnerException as PostgresException)?.MessageText;
}
