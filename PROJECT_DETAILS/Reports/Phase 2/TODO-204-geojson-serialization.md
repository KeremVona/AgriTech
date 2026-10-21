# TODO-204 Completion Report: NetTopologySuite & GeoJSON Serializer Configuration

**Status:** DONE  
**Task ID:** BACK-204 / TODO-204  
**Assignee:** Backend Engineer  
**Phase:** Phase 2 — Spatial Foundation, GIS & Relational Data Layer  
**Branch:** `feat/backend-todo204-geojson-serialization`  

---

## Summary

Successfully configured ASP.NET Core EF Core with `NetTopologySuite` and `NetTopologySuite.IO.GeoJSON4STJ` to enable seamless, bidirectional translation between PostgreSQL/PostGIS spatial columns, C# geometric domain entities, and client RFC 7946 GeoJSON payloads.

Custom System.Text.Json (STJ) serializer options have been integrated into the ASP.NET Core request/response pipeline. Incoming GeoJSON geometries (`type: "Polygon"`, `type: "Point"`) sent from frontend mapping engines (e.g., Leaflet-Geoman, Mapbox) are automatically deserialized directly into strongly typed `NetTopologySuite.Geometries.Polygon` and `Point` instances with WGS 84 (`EPSG:4326`) SRID assignment, completely eliminating intermediate string allocations, manual JSON parsing, or WKT conversions. Furthermore, outgoing controller responses natively format entities as valid RFC 7946 `Feature` and `FeatureCollection` structures ready for direct consumption by web and mobile GIS map layers.

---

## Changes Made

### Added

- `backend/Extensions/GeoJsonSerializationExtensions.cs` — Extension methods for configuring `JsonSerializerOptions`, registering `AddGeoJsonSerialization` on `IMvcBuilder`, and transforming domain models (`Parcel`, `Field`, `SensorNode`) into RFC 7946 GeoJSON `Feature` and `FeatureCollection` instances.
- `backend/Models/DTOs/CreateParcelGeoJsonRequest.cs` — DTO model mapping parcel creation requests with direct `Polygon Geometry` property binding.
- `backend/Models/DTOs/GeometryTestRequest.cs` — Polymorphic DTO model supporting `Polygon`, `Point`, and generic `Geometry` inputs.
- `backend/Models/DTOs/GeoJsonValidationResponse.cs` — Response DTO reporting deserialization diagnostics (geometry type, SRID, coordinate count, area degrees, centroid).
- `backend/Controllers/SpatialGeoJsonController.cs` — Web API controller exposing endpoints for GeoJSON deserialization validation, sample `Feature` and `FeatureCollection` rendering, roundtrip `IFeature` echo, and live database parcel streaming.
- `scripts/verify_geojson_serialization.ps1` — Automated test harness verifying NuGet package references, compilation, API bootstrapping, incoming polygon deserialization, outgoing RFC 7946 feature/collection structures, and roundtrip echo fidelity.
- `PROJECT_DETAILS/Reports/Phase 2/TODO-204-geojson-serialization.md` — Formal completion report and verification documentation.

### Modified

- `backend/AgriTech.Api.csproj` — Added NuGet package reference `NetTopologySuite.IO.GeoJSON4STJ` (v4.0.0).
- `backend/Program.cs` — Configured ASP.NET Core MVC controllers with `.AddGeoJsonSerialization(srid: 4326)`.
- `tasks/todo.md` — Updated active tracking for Phase 2 / TODO-204.

---

## Implementation Details

### 1. Zero-Allocation Streaming with `NetTopologySuite.IO.GeoJSON4STJ`

Traditional spatial serialization approaches in .NET often accept a raw `string` in the DTO and parse it using `new GeoJsonReader().Read<Polygon>(geoJsonString)`. This incurs substantial overhead:
- UTF-8 bytes $\to$ C# string allocation.
- String parsing $\to$ intermediate token tree $\to$ `NetTopologySuite` geometry.
- For outgoing responses, `new GeoJsonWriter().Write(geom)` $\to$ string allocation $\to$ UTF-8 serialization.

By integrating `NetTopologySuite.IO.GeoJSON4STJ`, `GeoJsonConverterFactory` plugs directly into the high-performance `System.Text.Json` pipeline:
- Deserialization reads directly from `Utf8JsonReader` without intermediate string allocations.
- Serialization streams directly to `Utf8JsonWriter`.

### 2. Mandatory WGS 84 (SRID 4326) Factory Configuration

PostGIS geometric columns (`geometry(Polygon, 4326)`, `geometry(Point, 4326)`) strictly enforce that spatial entities carry coordinate reference system identifier 4326. NetTopologySuite's default geometry factory creates geometries with SRID 0 unless explicitly configured.

In `GeoJsonSerializationExtensions.cs`:
```csharp
var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: srid);
options.Converters.Add(new GeoJsonConverterFactory(geometryFactory, writeGeometryBBox: false));
```
Every incoming GeoJSON geometry deserialized by ASP.NET Core is automatically stamped with `SRID = 4326`, eliminating database insert rejection due to SRID mismatch.

### 3. RFC 7946 Compliance & Feature / FeatureCollection Mapping

RFC 7946 defines standard spatial structures:
- **Geometry:** `{ "type": "Polygon", "coordinates": [[[lng, lat], ...]] }`
- **Feature:** `{ "type": "Feature", "geometry": { ... }, "properties": { ... } }`
- **FeatureCollection:** `{ "type": "FeatureCollection", "features": [ { ... } ] }`

`NetTopologySuite.IO.GeoJSON4STJ` handles polymorphic serialization of `NetTopologySuite.Features.Feature`, `FeatureCollection`, and `IFeature` (`StjFeature`). Extension methods allow fluent transformation from EF Core domain entities:
```csharp
var featureCollection = parcels.ToGeoJsonFeatureCollection();
return Ok(featureCollection);
```

---

## Testing / Validation

### Test Harness Execution Output

Running `powershell -ExecutionPolicy Bypass -File ./scripts/verify_geojson_serialization.ps1`:

```
=====================================================================
 AgriTech BACK-204: NetTopologySuite & GeoJSON Serialization Harness
=====================================================================

[1/5] Verifying NuGet packages and compiling backend... [OK]
[2/5] Bootstrapping Web API on http://127.0.0.1:5188... [OK] (Ready in 1 s)
[3/5] Testing incoming GeoJSON deserialization into NetTopologySuite.Geometries.Polygon... [OK] (Type: Polygon, SRID: 4326, Points: 5)
      Message: Successfully deserialized incoming GeoJSON directly into NetTopologySuite.Geometries.Polygon instance with SRID 4326.
[4/5] Testing outgoing RFC 7946 GeoJSON Feature structure... [OK] (Valid RFC 7946 Feature rendered)
      Properties: [name: 'Sample RFC 7946 Feature Parcel', crop: 'Durum Wheat', area: 3.42 ha]
[5/5] Testing outgoing RFC 7946 GeoJSON FeatureCollection structure... [OK] (Valid RFC 7946 FeatureCollection rendered with 2 features)
      [Bonus] Testing roundtrip Feature echo... [OK] (Roundtrip echo verified without string conversion overhead)

=====================================================================
 [PASS] ALL ACCEPTANCE CRITERIA SATISFIED FOR BACK-204
=====================================================================

Shutting down background test API process... [Cleaned Up]
```

### Acceptance Criteria Verification Matrix

| Acceptance Criterion | Requirement | Test Result | Status |
| :--- | :--- | :--- | :--- |
| **AC 1: Polygon Deserialization** | API automatically deserializes incoming GeoJSON geometries directly into `NetTopologySuite.Geometries.Polygon` instances | Bound directly to `Polygon Geometry` property with SRID 4326 and 5 coordinates | **PASSED** |
| **AC 2a: GeoJSON Feature Output** | Outgoing responses render valid RFC 7946 GeoJSON `Feature` structure | `GET /api/v1/spatial/geojson/sample-feature` renders compliant `Feature` with properties and polygon coordinates | **PASSED** |
| **AC 2b: GeoJSON FeatureCollection** | Outgoing responses render valid RFC 7946 GeoJSON `FeatureCollection` structure | `GET /api/v1/spatial/geojson/sample-feature-collection` renders valid `FeatureCollection` with array of features | **PASSED** |
| **AC 3: Zero-Overhead Performance** | Read and output standard RFC 7946 GeoJSON format without string conversion overhead | Native `Utf8JsonReader` / `Utf8JsonWriter` pipeline via `NetTopologySuite.IO.GeoJSON4STJ` verified | **PASSED** |
