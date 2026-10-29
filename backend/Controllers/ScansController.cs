using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;

namespace AgriTech.Api.Controllers;

/// <summary>
/// RESTful controller for foliar diagnostic crop scan ingestion and retrieval (BACK-206).
///
/// Endpoints:
///   POST /api/v1/scans       - Ingests a new crop scan with automatic spatial parcel resolution.
///   GET  /api/v1/scans/{id}  - Retrieves a specific scan by ID with enriched parcel context.
///   GET  /api/v1/scans       - Lists scans, optionally filtered by parcel_id.
/// </summary>
[ApiController]
[Route("api/v1/scans")]
[Produces("application/json")]
public class ScansController : ControllerBase
{
    private readonly AgriTechDbContext _db;
    private readonly ILogger<ScansController> _logger;
    private readonly GeometryFactory _geometryFactory;

    public ScansController(AgriTechDbContext db, ILogger<ScansController> logger)
    {
        _db = db;
        _logger = logger;
        _geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
    }

    /// <summary>
    /// Ingests a foliar crop diagnostic scan from mobile inspection apps, field rovers, or IoT cameras.
    ///
    /// Spatial Auto-Resolution (BACK-206):
    ///   • If `parcel_id` is omitted in the request payload, the backend executes a PostGIS point-in-polygon
    ///     lookup (`fn_locate_parcel_by_coordinate`) using (longitude, latitude).
    ///   • When the coordinate lands inside a parcel, `parcel_id` is automatically populated before persistence.
    ///   • When the coordinate is outside any managed parcel boundary, `parcel_id` is assigned `NULL`
    ///     and the scan is persisted cleanly without throwing unhandled exceptions.
    /// </summary>
    /// <param name="request">Crop scan ingestion payload with GPS coordinates, image URL, and inference ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>201 Created with full CropScanResponseDto.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(CropScanResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CropScanResponseDto>> IngestScan(
        [FromBody] CreateCropScanRequest request,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Ingesting crop scan at ({Latitude}, {Longitude}) for inference {InferenceId}",
            request.Latitude, request.Longitude, request.InferenceId);

        // 1. Validate referenced ModelInference exists
        var inferenceExists = await _db.ModelInferences.AnyAsync(m => m.Id == request.InferenceId, cancellationToken);
        if (!inferenceExists)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid Model Inference",
                Detail = $"Referenced model_inference with ID '{request.InferenceId}' does not exist.",
                Instance = HttpContext.Request.Path
            });
        }

        // 2. Validate referenced User if supplied
        if (request.UploadedByUserId.HasValue)
        {
            var userExists = await _db.Users.AnyAsync(u => u.Id == request.UploadedByUserId.Value, cancellationToken);
            if (!userExists)
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid User Reference",
                    Detail = $"Referenced user with ID '{request.UploadedByUserId.Value}' does not exist.",
                    Instance = HttpContext.Request.Path
                });
            }
        }

        // 3. Resolve parcel_id via spatial reverse-lookup (BACK-206)
        Guid? resolvedParcelId;
        if (request.ParcelId.HasValue)
        {
            // Explicit override provided: verify target parcel exists
            var parcelExists = await _db.Parcels.AnyAsync(p => p.Id == request.ParcelId.Value, cancellationToken);
            if (!parcelExists)
            {
                return NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Target Parcel Not Found",
                    Detail = $"Explicitly supplied parcel_id '{request.ParcelId.Value}' does not exist.",
                    Instance = HttpContext.Request.Path
                });
            }
            resolvedParcelId = request.ParcelId.Value;
        }
        else
        {
            // Automatic spatial point-in-polygon resolution via GiST index (fn_locate_parcel_by_coordinate)
            var lookup = await _db.LocateParcelByCoordinateAsync(request.Longitude, request.Latitude, cancellationToken);
            if (lookup != null)
            {
                resolvedParcelId = lookup.ParcelId;
                _logger.LogInformation("Coordinate ({Latitude}, {Longitude}) auto-resolved to parcel '{ParcelName}' ({ParcelId})",
                    request.Latitude, request.Longitude, lookup.ParcelName, lookup.ParcelId);
            }
            else
            {
                // Coordinate outside managed parcel boundary: set NULL without throwing unhandled exceptions
                resolvedParcelId = null;
                _logger.LogInformation("Coordinate ({Latitude}, {Longitude}) is outside managed parcels; assigning parcel_id = NULL.",
                    request.Latitude, request.Longitude);
            }
        }

        // 4. Construct Point geometry (SRID 4326 - WGS 84: X = Longitude, Y = Latitude)
        var geomPoint = _geometryFactory.CreatePoint(new Coordinate(request.Longitude, request.Latitude));

        // 5. Build and persist CropScan entity
        var scan = new CropScan
        {
            Id                  = Guid.NewGuid(),
            ParcelId            = resolvedParcelId,
            InferenceId         = request.InferenceId,
            UploadedByUserId    = request.UploadedByUserId,
            ImageUrl            = request.ImageUrl,
            GeomPoint           = geomPoint,
            GpsAccuracyMeters   = request.GpsAccuracyMeters,
            DetectionSource     = string.IsNullOrWhiteSpace(request.DetectionSource) ? "EXIF_GPS" : request.DetectionSource,
            FieldNotes          = request.FieldNotes,
            ScannedAt           = request.ScannedAt ?? DateTime.UtcNow
        };

        _db.CropScans.Add(scan);
        await _db.SaveChangesAsync(cancellationToken);

        // 6. Eager-load relations for response projection
        if (resolvedParcelId.HasValue)
        {
            await _db.Entry(scan)
                .Reference(s => s.Parcel)
                .Query()
                .Include(p => p!.Field)
                .Include(p => p!.Crop)
                .LoadAsync(cancellationToken);
        }

        var responseDto = scan.ToResponseDto();
        return CreatedAtAction(nameof(GetScanById), new { id = scan.Id }, responseDto);
    }

    /// <summary>
    /// Retrieves a single crop scan by unique ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CropScanResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CropScanResponseDto>> GetScanById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var scan = await _db.CropScans
            .Include(s => s.Parcel)
                .ThenInclude(p => p!.Field)
            .Include(s => s.Parcel)
                .ThenInclude(p => p!.Crop)
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (scan == null)
        {
            return NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Crop Scan Not Found",
                Detail = $"No crop scan found with ID '{id}'.",
                Instance = HttpContext.Request.Path
            });
        }

        return Ok(scan.ToResponseDto());
    }

    /// <summary>
    /// Lists crop scans, optionally filtered by parcel ID.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<CropScanResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<CropScanResponseDto>>> ListScans(
        [FromQuery] Guid? parcelId,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var query = _db.CropScans
            .Include(s => s.Parcel)
                .ThenInclude(p => p!.Field)
            .Include(s => s.Parcel)
                .ThenInclude(p => p!.Crop)
            .AsNoTracking();

        if (parcelId.HasValue)
        {
            query = query.Where(s => s.ParcelId == parcelId.Value);
        }

        var scans = await query
            .OrderByDescending(s => s.ScannedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .ToListAsync(cancellationToken);

        return Ok(scans.Select(s => s.ToResponseDto()).ToList());
    }
}
