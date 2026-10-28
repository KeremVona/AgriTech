using AgriTech.Api.Models;
using AgriTech.Api.Models.DTOs;

namespace AgriTech.Api.Extensions;

/// <summary>
/// Mapping helpers that translate EF Core domain entities into response DTOs.
/// Centralises all projection logic so controllers remain lean.
/// </summary>
public static class SpatialMappingExtensions
{
    // ─────────────────────────────────────────────────────────────────────────
    // Field mappings
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Projects a Field entity to a FieldResponseDto, computing the bounding box
    /// in-process from the polygon envelope (no extra DB round-trip needed).
    /// The parcels list is included only when the entity has been loaded with
    /// .Include(f => f.Parcels) and the caller explicitly opts-in (includeParcels: true).
    /// </summary>
    public static FieldResponseDto ToResponseDto(this Field field, bool includeParcels = false)
    {
        return new FieldResponseDto
        {
            Id                 = field.Id,
            Name               = field.Name,
            OwnerId            = field.OwnerId,
            LocationName       = field.LocationName,
            TotalAreaHectares  = field.TotalAreaHectares,
            BoundingBox        = BoundingBoxDto.FromGeometry(field.BoundaryGeom),
            ParcelCount        = field.Parcels?.Count ?? 0,
            MadeAt             = field.MadeAt,
            UpdatedAt          = field.UpdatedAt,
            Parcels            = includeParcels
                                     ? field.Parcels?.Select(p => p.ToSummaryDto()).ToList()
                                     : null
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Parcel mappings
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Projects a Parcel entity to a full ParcelResponseDto.
    /// The BoundingBox is computed from the NetTopologySuite Polygon's
    /// EnvelopeInternal, which is O(1) and allocation-free.
    /// </summary>
    public static ParcelResponseDto ToResponseDto(this Parcel parcel)
    {
        return new ParcelResponseDto
        {
            Id                 = parcel.Id,
            FieldId            = parcel.FieldId,
            FieldName          = parcel.Field?.Name,
            CropId             = parcel.CropId,
            CropName           = parcel.Crop?.CommonName,
            SoilProfileId      = parcel.SoilProfileId,
            SoilProfileName    = parcel.SoilProfile?.Name,
            Name               = parcel.Name,
            BoundaryGeom       = parcel.BoundaryGeom,
            AreaHectares       = parcel.AreaHectares,
            BoundingBox        = BoundingBoxDto.FromGeometry(parcel.BoundaryGeom),
            PlantingDate       = parcel.PlantingDate,
            KcCurrent          = parcel.KcCurrent,
            IrrigationMethod   = parcel.IrrigationMethod,
            SystemFlowRateLpm  = parcel.SystemFlowRateLpm,
            IrrigationEfficiency = parcel.IrrigationEfficiency,
            MadeAt             = parcel.MadeAt,
            UpdatedAt          = parcel.UpdatedAt
        };
    }

    /// <summary>
    /// Projects a Parcel to a lightweight ParcelSummaryDto embedded in FieldResponseDto.
    /// Does not include the geometry to reduce payload size on list endpoints.
    /// </summary>
    public static ParcelSummaryDto ToSummaryDto(this Parcel parcel)
    {
        return new ParcelSummaryDto
        {
            Id           = parcel.Id,
            Name         = parcel.Name,
            CropName     = parcel.Crop?.CommonName,
            AreaHectares = parcel.AreaHectares,
            PlantingDate = parcel.PlantingDate
        };
    }
}
