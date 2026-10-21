using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Controllers;

[ApiController]
[Route("api/v1/spatial/geojson")]
[Produces("application/json")]
public class SpatialGeoJsonController : ControllerBase
{
    private readonly AgriTechDbContext _dbContext;
    private readonly GeometryFactory _geometryFactory;

    public SpatialGeoJsonController(AgriTechDbContext dbContext)
    {
        _dbContext = dbContext;
        _geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
    }

    /// <summary>
    /// Acceptance Criterion 1: Verifies that an incoming GeoJSON Polygon is automatically deserialized
    /// into a NetTopologySuite.Geometries.Polygon instance without manual string conversion.
    /// </summary>
    [HttpPost("deserialize-polygon")]
    public ActionResult<GeoJsonValidationResponse> DeserializePolygon([FromBody] CreateParcelGeoJsonRequest request)
    {
        if (request.Geometry == null)
        {
            return BadRequest(new GeoJsonValidationResponse
            {
                IsValid = false,
                Message = "Geometry payload cannot be null."
            });
        }

        var centroid = request.Geometry.Centroid;

        return Ok(new GeoJsonValidationResponse
        {
            IsValid = request.Geometry.IsValid,
            GeometryType = request.Geometry.GeometryType,
            Srid = request.Geometry.SRID,
            CoordinateCount = request.Geometry.Coordinates.Length,
            AreaDegrees = request.Geometry.Area,
            Centroid = centroid != null ? new CentroidDto
            {
                Longitude = centroid.X,
                Latitude = centroid.Y
            } : null,
            Message = $"Successfully deserialized incoming GeoJSON directly into NetTopologySuite.Geometries.Polygon instance with SRID {request.Geometry.SRID}."
        });
    }

    /// <summary>
    /// Demonstrates generic/polymorphic GeoJSON geometry deserialization (Point, Polygon, etc.).
    /// </summary>
    [HttpPost("deserialize-geometry")]
    public ActionResult<GeoJsonValidationResponse> DeserializeGeometry([FromBody] GeometryTestRequest request)
    {
        var geom = request.Polygon ?? request.Geometry ?? (Geometry?)request.Point;
        if (geom == null)
        {
            return BadRequest(new GeoJsonValidationResponse
            {
                IsValid = false,
                Message = "No spatial geometry detected in request payload."
            });
        }

        var centroid = geom.Centroid;

        return Ok(new GeoJsonValidationResponse
        {
            IsValid = geom.IsValid,
            GeometryType = geom.GeometryType,
            Srid = geom.SRID,
            CoordinateCount = geom.Coordinates.Length,
            AreaDegrees = geom.Area,
            Centroid = centroid != null ? new CentroidDto
            {
                Longitude = centroid.X,
                Latitude = centroid.Y
            } : null,
            Message = $"Successfully deserialized incoming {geom.GeometryType} directly into {geom.GetType().FullName}."
        });
    }

    /// <summary>
    /// Acceptance Criterion 2a: Outgoing response rendering a valid RFC 7946 GeoJSON Feature structure.
    /// </summary>
    [HttpGet("sample-feature")]
    public ActionResult<Feature> GetSampleFeature()
    {
        var coordinates = new[]
        {
            new Coordinate(28.97412, 41.02511),
            new Coordinate(28.97650, 41.02515),
            new Coordinate(28.97630, 41.02340),
            new Coordinate(28.97390, 41.02335),
            new Coordinate(28.97412, 41.02511)
        };

        var polygon = _geometryFactory.CreatePolygon(coordinates);

        var attributes = new AttributesTable
        {
            { "id", Guid.Parse("f1000000-0000-0000-0000-000000000001") },
            { "name", "Sample RFC 7946 Feature Parcel" },
            { "crop_name", "Durum Wheat" },
            { "area_hectares", 3.42 },
            { "status", "ACTIVE" }
        };

        var feature = new Feature(polygon, attributes);
        return Ok(feature);
    }

    /// <summary>
    /// Acceptance Criterion 2b: Outgoing response rendering a valid RFC 7946 GeoJSON FeatureCollection structure.
    /// </summary>
    [HttpGet("sample-feature-collection")]
    public ActionResult<FeatureCollection> GetSampleFeatureCollection()
    {
        var featureCollection = new FeatureCollection();

        // Feature 1: North Parcel
        var coords1 = new[]
        {
            new Coordinate(28.9740, 41.0250),
            new Coordinate(28.9760, 41.0250),
            new Coordinate(28.9760, 41.0240),
            new Coordinate(28.9740, 41.0240),
            new Coordinate(28.9740, 41.0250)
        };
        var poly1 = _geometryFactory.CreatePolygon(coords1);
        var attr1 = new AttributesTable
        {
            { "id", Guid.Parse("f1000000-0000-0000-0000-000000000001") },
            { "name", "North Field - Alpha" },
            { "crop", "Corn" },
            { "area_hectares", 2.15 }
        };
        featureCollection.Add(new Feature(poly1, attr1));

        // Feature 2: South Parcel
        var coords2 = new[]
        {
            new Coordinate(28.9740, 41.0240),
            new Coordinate(28.9760, 41.0240),
            new Coordinate(28.9760, 41.0230),
            new Coordinate(28.9740, 41.0230),
            new Coordinate(28.9740, 41.0240)
        };
        var poly2 = _geometryFactory.CreatePolygon(coords2);
        var attr2 = new AttributesTable
        {
            { "id", Guid.Parse("f1000000-0000-0000-0000-000000000002") },
            { "name", "South Field - Beta" },
            { "crop", "Soybean" },
            { "area_hectares", 2.15 }
        };
        featureCollection.Add(new Feature(poly2, attr2));

        return Ok(featureCollection);
    }

    /// <summary>
    /// Accepts an RFC 7946 IFeature directly from client JSON and echoes it back.
    /// NetTopologySuite.IO.GeoJSON4STJ deserializes GeoJSON features as IFeature (StjFeature).
    /// </summary>
    [HttpPost("echo-feature")]
    public ActionResult<IFeature> EchoFeature([FromBody] IFeature feature)
    {
        if (feature?.Geometry == null)
        {
            return BadRequest("Feature or feature geometry cannot be null.");
        }

        return Ok(feature);
    }

    /// <summary>
    /// Live Database Query: Retrieves all parcels in the database and streams them as an RFC 7946 GeoJSON FeatureCollection.
    /// </summary>
    [HttpGet("parcels")]
    public async Task<ActionResult<FeatureCollection>> GetParcelsGeoJson(CancellationToken cancellationToken)
    {
        var parcels = await _dbContext.Parcels
            .Include(p => p.Crop)
            .Include(p => p.Field)
            .Include(p => p.SoilProfile)
            .AsNoTracking()
            .Take(100)
            .ToListAsync(cancellationToken);

        var featureCollection = parcels.ToGeoJsonFeatureCollection();
        return Ok(featureCollection);
    }
}
