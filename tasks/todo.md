# TODO-204: NetTopologySuite & GeoJSON Serializer Configuration

## Current Status: COMPLETED
**Branch:** `feat/backend-todo204-geojson-serialization`  
**Assignee:** Backend Engineer  
**Phase:** Phase 2 — Spatial Foundation, GIS & Relational Data Layer  

---

- [x] **Subtask 1: Spatial & GeoJSON NuGet Integration**
  - Verified `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite` (v10.0.3) for PostGIS spatial mapping in EF Core.
  - Added `NetTopologySuite.IO.GeoJSON4STJ` (v4.0.0) providing native System.Text.Json (STJ) GeoJSON converters.

- [x] **Subtask 2: System.Text.Json Custom Serializer Configuration (`GeoJsonSerializationExtensions.cs`)**
  - Implemented `ConfigureGeoJsonOptions` configuring `GeoJsonConverterFactory` with `GeometryFactory(srid: 4326)`.
  - Enforced WGS 84 (EPSG:4326) coordinate reference system tagging on all incoming geometries.
  - Streamlined zero-overhead JSON serialization reading/writing directly via `Utf8JsonReader` and `Utf8JsonWriter` without intermediate string conversions.
  - Implemented domain entity mapping extension methods (`ToGeoJsonFeature`, `ToGeoJsonFeatureCollection`) for `Parcel`, `Field`, and `SensorNode`.

- [x] **Subtask 3: ASP.NET Core Web API Pipeline Registration (`Program.cs`)**
  - Registered `.AddGeoJsonSerialization(srid: 4326)` on `IMvcBuilder` in `Program.cs`.
  - Enabled automatic model binding and validation of GeoJSON payloads across all API controllers.

- [x] **Subtask 4: Spatial DTOs & Validation Models (`Models/DTOs/`)**
  - Created `CreateParcelGeoJsonRequest.cs` binding incoming GeoJSON geometry directly into `NetTopologySuite.Geometries.Polygon`.
  - Created `GeometryTestRequest.cs` supporting polymorphic GeoJSON geometry deserialization.
  - Created `GeoJsonValidationResponse.cs` reporting geometry type, coordinate count, SRID, and centroid metrics.

- [x] **Subtask 5: Spatial GeoJSON Controller Endpoints (`SpatialGeoJsonController.cs`)**
  - `POST /api/v1/spatial/geojson/deserialize-polygon` — Ingests client GeoJSON and automatically deserializes into `Polygon` (AC 1).
  - `POST /api/v1/spatial/geojson/deserialize-geometry` — Polymorphic geometry deserialization.
  - `GET /api/v1/spatial/geojson/sample-feature` — Produces valid RFC 7946 GeoJSON `Feature` (AC 2a).
  - `GET /api/v1/spatial/geojson/sample-feature-collection` — Produces valid RFC 7946 GeoJSON `FeatureCollection` (AC 2b).
  - `POST /api/v1/spatial/geojson/echo-feature` — Verifies roundtrip Feature deserialization as `IFeature` (`StjFeature`).
  - `GET /api/v1/spatial/geojson/parcels` — Streams live database parcels as RFC 7946 `FeatureCollection`.

- [x] **Subtask 6: Automated Verification Test Harness (`scripts/verify_geojson_serialization.ps1`)**
  - Automated PowerShell test harness executing:
    - Test 1: NuGet package & compilation check -> PASS.
    - Test 2: Web API bootstrapping on test port -> PASS.
    - Test 3: Deserialization into `NetTopologySuite.Geometries.Polygon` with SRID 4326 -> PASS.
    - Test 4: RFC 7946 GeoJSON `Feature` output validation -> PASS.
    - Test 5: RFC 7946 GeoJSON `FeatureCollection` output validation -> PASS.
    - Bonus: Roundtrip `IFeature` echo without string conversion overhead -> PASS.

- [x] **Subtask 7: Formal Completion Report (DoD) & Documentation**
  - Created `PROJECT_DETAILS/Reports/Phase 2/TODO-204-geojson-serialization.md`.
  - Updated `tasks/todo.md`.
