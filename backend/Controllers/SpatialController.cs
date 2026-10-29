using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgriTech.Api.Controllers;

/// <summary>
/// Spatial analytics and reverse-geotagging endpoints (BACK-206).
///
/// Endpoints:
///   POST /api/v1/spatial/locate-coordinate  - Ingests GPS coordinate pair and resolves enclosing parcel entity.
///   GET  /api/v1/spatial/locate-coordinate  - Query-string alternative for GIS clients and inspection dashboards.
/// </summary>
[ApiController]
[Route("api/v1/spatial")]
[Produces("application/json")]
public class SpatialController : ControllerBase
{
    private readonly AgriTechDbContext _db;
    private readonly ILogger<SpatialController> _logger;

    public SpatialController(AgriTechDbContext db, ILogger<SpatialController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Reverse-lookup: Ingests GPS coordinate pairs (latitude, longitude) from mobile inspection devices,
    /// drone telemetry, or IoT sensors, and resolves the enclosing managed parcel.
    ///
    /// Executes the optimized PostGIS stored procedure `fn_locate_parcel_by_coordinate` (BACK-203),
    /// leveraging the underlying GiST spatial index `idx_parcels_boundary` (&lt; 10 ms execution target).
    /// </summary>
    /// <param name="request">Coordinate pair payload containing latitude and longitude.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>
    ///   200 OK: Full parcel entity metadata including bounding box, crop, field, and geometry.
    ///   404 Not Found: Coordinates do not fall within any managed agricultural parcel.
    ///   400 Bad Request: Coordinate values out of range (lat: [-90, 90], lng: [-180, 180]).
    /// </returns>
    [HttpPost("locate-coordinate")]
    [ProducesResponseType(typeof(ParcelResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ParcelResponseDto>> LocateCoordinate(
        [FromBody] LocateCoordinateRequest request,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Processing spatial point-in-polygon lookup for ({Latitude}, {Longitude})",
            request.Latitude, request.Longitude);

        // Execute PostGIS Point-in-Polygon stored procedure (BACK-203)
        var lookup = await _db.LocateParcelByCoordinateAsync(request.Longitude, request.Latitude, cancellationToken);

        if (lookup == null)
        {
            _logger.LogInformation("Coordinate ({Latitude}, {Longitude}) is outside all managed parcels.",
                request.Latitude, request.Longitude);

            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Coordinate Outside Managed Parcels",
                Detail = $"No managed agricultural parcel encloses coordinates (lat: {request.Latitude:F6}, lng: {request.Longitude:F6}). Coordinates are outside managed parcels.",
                Instance = HttpContext.Request.Path
            });
        }

        // Fetch full parcel entity with eager-loaded relations (Field, Crop, SoilProfile)
        var parcel = await _db.Parcels
            .Include(p => p.Field)
            .Include(p => p.Crop)
            .Include(p => p.SoilProfile)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == lookup.ParcelId, cancellationToken);

        if (parcel == null)
        {
            _logger.LogWarning("Lookup returned parcel ID {ParcelId} but entity was not found in DB.", lookup.ParcelId);
            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Parcel Entity Not Found",
                Detail = $"Resolved parcel ID '{lookup.ParcelId}' could not be loaded."
            });
        }

        return Ok(parcel.ToResponseDto());
    }

    /// <summary>
    /// Query-string alternative for GET requests (convenient for browser testing and GIS query builders).
    /// </summary>
    [HttpGet("locate-coordinate")]
    [ProducesResponseType(typeof(ParcelResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ParcelResponseDto>> LocateCoordinateGet(
        [FromQuery] double latitude,
        [FromQuery] double longitude,
        CancellationToken cancellationToken)
    {
        if (latitude < -90.0 || latitude > 90.0)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid Latitude",
                Detail = "Latitude must be between -90.0 and 90.0 degrees."
            });
        }

        if (longitude < -180.0 || longitude > 180.0)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid Longitude",
                Detail = "Longitude must be between -180.0 and 180.0 degrees."
            });
        }

        return await LocateCoordinate(new LocateCoordinateRequest
        {
            Latitude = latitude,
            Longitude = longitude
        }, cancellationToken);
    }
}
