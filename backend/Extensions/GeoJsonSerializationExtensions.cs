using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Converters;
using AgriTech.Api.Models;

namespace AgriTech.Api.Extensions;

/// <summary>
/// Provides extension methods for configuring NetTopologySuite GeoJSON serialization
/// using System.Text.Json (STJ) and mapping domain entities to RFC 7946 GeoJSON structures.
/// </summary>
public static class GeoJsonSerializationExtensions
{
    public const int DefaultSpatialReferenceId = 4326; // WGS 84 (GPS standard)

    /// <summary>
    /// Configures System.Text.Json serializer options with NetTopologySuite GeoJSON converters
    /// enforcing WGS 84 (SRID 4326) and native Utf8JsonReader/Writer streaming without string conversion overhead.
    /// </summary>
    public static JsonSerializerOptions ConfigureGeoJsonOptions(this JsonSerializerOptions options, int srid = DefaultSpatialReferenceId)
    {
        var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: srid);

        // Add GeoJsonConverterFactory:
        // - Uses WGS 84 (EPSG:4326) GeometryFactory so incoming coordinates are tagged with SRID 4326
        // - writeGeometryBBox: false (standard RFC 7946 coordinates layout)
        options.Converters.Add(new GeoJsonConverterFactory(geometryFactory, writeGeometryBBox: false));

        // Use camelCase or snake_case for standard JSON responses
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;

        return options;
    }

    /// <summary>
    /// Configures ASP.NET Core MVC / Web API Controllers with NetTopologySuite GeoJSON converters.
    /// </summary>
    public static IMvcBuilder AddGeoJsonSerialization(this IMvcBuilder builder, int srid = DefaultSpatialReferenceId)
    {
        builder.AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.ConfigureGeoJsonOptions(srid);
        });

        return builder;
    }

    /// <summary>
    /// Maps a Parcel entity to a standard RFC 7946 GeoJSON Feature.
    /// </summary>
    public static Feature ToGeoJsonFeature(this Parcel parcel)
    {
        var attributes = new AttributesTable
        {
            { "id", parcel.Id },
            { "name", parcel.Name },
            { "field_id", parcel.FieldId },
            { "field_name", parcel.Field?.Name },
            { "crop_id", parcel.CropId },
            { "crop_name", parcel.Crop?.CommonName },
            { "soil_profile_id", parcel.SoilProfileId },
            { "soil_profile_name", parcel.SoilProfile?.Name },
            { "area_hectares", parcel.AreaHectares },
            { "planting_date", parcel.PlantingDate.ToString("yyyy-MM-dd") },
            { "kc_current", parcel.KcCurrent },
            { "irrigation_method", parcel.IrrigationMethod },
            { "system_flow_rate_lpm", parcel.SystemFlowRateLpm },
            { "irrigation_efficiency", parcel.IrrigationEfficiency },
            { "updated_at", parcel.UpdatedAt }
        };

        return new Feature(parcel.BoundaryGeom, attributes);
    }

    /// <summary>
    /// Maps an enumerable of Parcel entities to a standard RFC 7946 GeoJSON FeatureCollection.
    /// </summary>
    public static FeatureCollection ToGeoJsonFeatureCollection(this IEnumerable<Parcel> parcels)
    {
        var collection = new FeatureCollection();
        foreach (var parcel in parcels)
        {
            collection.Add(parcel.ToGeoJsonFeature());
        }
        return collection;
    }

    /// <summary>
    /// Maps a Field entity to a standard RFC 7946 GeoJSON Feature.
    /// </summary>
    public static Feature ToGeoJsonFeature(this Field field)
    {
        var attributes = new AttributesTable
        {
            { "id", field.Id },
            { "name", field.Name },
            { "owner_id", field.OwnerId },
            { "total_area_hectares", field.TotalAreaHectares },
            { "parcels_count", field.Parcels?.Count ?? 0 },
            { "updated_at", field.UpdatedAt }
        };

        return new Feature(field.BoundaryGeom, attributes);
    }

    /// <summary>
    /// Maps an enumerable of Field entities to a standard RFC 7946 GeoJSON FeatureCollection.
    /// </summary>
    public static FeatureCollection ToGeoJsonFeatureCollection(this IEnumerable<Field> fields)
    {
        var collection = new FeatureCollection();
        foreach (var field in fields)
        {
            collection.Add(field.ToGeoJsonFeature());
        }
        return collection;
    }

    /// <summary>
    /// Maps a SensorNode entity to a standard RFC 7946 GeoJSON Feature (Point).
    /// </summary>
    public static Feature ToGeoJsonFeature(this SensorNode sensorNode)
    {
        var attributes = new AttributesTable
        {
            { "id", sensorNode.Id },
            { "hardware_uid", sensorNode.HardwareUid },
            { "parcel_id", sensorNode.ParcelId },
            { "is_virtual", sensorNode.IsVirtual },
            { "installed_at", sensorNode.InstalledAt }
        };

        return new Feature(sensorNode.GeomPoint, attributes);
    }

    /// <summary>
    /// Maps an enumerable of SensorNode entities to a standard RFC 7946 GeoJSON FeatureCollection.
    /// </summary>
    public static FeatureCollection ToGeoJsonFeatureCollection(this IEnumerable<SensorNode> sensorNodes)
    {
        var collection = new FeatureCollection();
        foreach (var node in sensorNodes)
        {
            collection.Add(node.ToGeoJsonFeature());
        }
        return collection;
    }
}
