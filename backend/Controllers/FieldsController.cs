using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AgriTech.Api.Controllers;

/// <summary>
/// RESTful controller for farm field lifecycle management.
///
/// Endpoints:
///   GET  /api/v1/fields            - List all fields (lightweight DTOs, optional GeoJSON)
///   POST /api/v1/fields            - Create a new field with a validated polygon boundary
///   GET  /api/v1/fields/{id}       - Retrieve a specific field with parcels and bounding box
///
/// Spatial flow:
///   1. Incoming GeoJSON polygon is deserialized directly to NetTopologySuite.Geometries.Polygon
///      by the GeoJSON4STJ converter (BACK-204) — no string conversion overhead.
///   2. [ValidPolygon] attribute (BACK-205) enforces N≥4, ring closure, and IsValid
///      before any database interaction.
///   3. EF Core writes the polygon to PostGIS geometry(Polygon, 4326).
///   4. The PostgreSQL calculate_field_area() trigger (BACK-202) automatically computes
///      total_area_hectares = ROUND(ST_Area(boundary_geom::geography) / 10000, 2).
///   5. The bounding box is computed in-process from EnvelopeInternal (O(1), zero DB cost).
/// </summary>
[ApiController]
[Route("api/v1/fields")]
[Produces("application/json")]
public class FieldsController : ControllerBase
{
    private readonly AgriTechDbContext _db;
    private readonly ILogger<FieldsController> _logger;

    public FieldsController(AgriTechDbContext db, ILogger<FieldsController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/fields
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns all farm fields as a list of FieldResponseDtos.
    /// Optional query param ?owner_id={guid} filters by owner.
    ///
    /// No geometry is included in list items to keep payload compact;
    /// use GET /{id} to fetch the full polygon.
    /// Parcel counts are derived from the loaded navigation collection.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<FieldResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<FieldResponseDto>>> GetFields(
        [FromQuery] Guid? ownerId,
        CancellationToken cancellationToken)
    {
        var query = _db.Fields
            .Include(f => f.Parcels)
            .AsNoTracking();

        if (ownerId.HasValue)
            query = query.Where(f => f.OwnerId == ownerId.Value);

        var fields = await query
            .OrderBy(f => f.Name)
            .ToListAsync(cancellationToken);

        return Ok(fields.Select(f => f.ToResponseDto(includeParcels: false)).ToList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/fields
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a new farm field with a spatial polygon boundary.
    ///
    /// Validation pipeline (short-circuits at first failure):
    ///   1. ASP.NET Core ModelState validation — [Required], [MaxLength], [ValidPolygon].
    ///   2. Owner existence check — 404 if OwnerId does not reference a users row.
    ///   3. PostgreSQL chk_fields_boundary_valid CHECK constraint — rejects invalid geometry.
    ///   4. PostgreSQL calculate_field_area() BEFORE INSERT trigger — writes area_hectares.
    ///
    /// Returns 201 Created with Location header pointing to GET /{id}.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(FieldResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FieldResponseDto>> CreateField(
        [FromBody] CreateFieldRequest request,
        CancellationToken cancellationToken)
    {
        // --- Owner existence check (prevents orphan FK before hitting the DB) ---
        var ownerExists = await _db.Users.AnyAsync(u => u.Id == request.OwnerId, cancellationToken);
        if (!ownerExists)
            return NotFound(new { message = $"Owner with id '{request.OwnerId}' was not found." });

        var field = new Field
        {
            OwnerId      = request.OwnerId,
            Name         = request.Name,
            LocationName = request.LocationName,
            BoundaryGeom = request.BoundaryGeom,
            MadeAt       = DateTime.UtcNow,
            UpdatedAt    = DateTime.UtcNow
        };

        _db.Fields.Add(field);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsPostgresCheckViolation(ex))
        {
            // The chk_fields_boundary_valid CHECK constraint fired — ST_IsValid returned false.
            // Return 400 rather than 500 so the client understands it sent invalid geometry.
            return BadRequest(new
            {
                message = "The polygon geometry is invalid according to PostGIS ST_IsValid. " +
                          "Ensure the boundary does not self-intersect.",
                detail = ExtractPostgresMessage(ex)
            });
        }

        // Reload to get the DB-computed total_area_hectares from the trigger
        await _db.Entry(field).ReloadAsync(cancellationToken);

        var dto = field.ToResponseDto(includeParcels: false);

        _logger.LogInformation(
            "Field {FieldId} '{Name}' created — {Area} ha", field.Id, field.Name, field.TotalAreaHectares);

        return CreatedAtAction(nameof(GetFieldById), new { id = field.Id }, dto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/fields/{id}
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns a single field with its full bounding box and a lightweight parcel summary list.
    /// The full parcel geometries are NOT included here; use GET /api/v1/fields/{id}/parcels
    /// (ParcelsController) to fetch them as a GeoJSON FeatureCollection.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FieldResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<FieldResponseDto>> GetFieldById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var field = await _db.Fields
            .Include(f => f.Parcels)
                .ThenInclude(p => p.Crop)
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

        if (field is null)
            return NotFound(new { message = $"Field '{id}' was not found." });

        return Ok(field.ToResponseDto(includeParcels: true));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static bool IsPostgresCheckViolation(DbUpdateException ex)
    {
        // PostgreSQL error code 23514 = check_violation
        var inner = ex.InnerException as PostgresException;
        return inner?.SqlState == "23514";
    }

    private static string? ExtractPostgresMessage(DbUpdateException ex)
        => (ex.InnerException as PostgresException)?.MessageText;
}
