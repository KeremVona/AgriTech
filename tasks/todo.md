# TODO-202: Spatial Table Schemas & GiST Spatial Indexes

## Current Status: COMPLETED
**Branch:** `feat/backend-todo202-spatial-tables-gist`  
**Assignee:** Backend / Database Engineer  
**Phase:** Phase 2 — Spatial Foundation, GIS & Relational Data Layer  

---

- [x] **Subtask 1: Entity Model Implementation (`backend/Models/`)**
  - Implement C# domain entities: `User.cs`, `Field.cs`, `Parcel.cs`, `SensorNode.cs`, `CropScan.cs`, `Crop.cs`, `SoilProfile.cs`, `ModelInference.cs`.
  - Use `NetTopologySuite.Geometries.Polygon` and `NetTopologySuite.Geometries.Point` for spatial representations.

- [x] **Subtask 2: DbContext Mapping & Spatial Index Configuration (`AgriTechDbContext.cs`)**
  - Register `DbSet` collections for all domain entities.
  - Map explicit column types: `geometry(Polygon, 4326)` and `geometry(Point, 4326)`.
  - Configure explicit GiST spatial indexes: `idx_fields_boundary`, `idx_parcels_boundary`, `idx_sensor_nodes_point`, `idx_crop_scans_point`.
  - Configure Foreign Key cascade rules:
    - `Field` -> `Parcels`: `CASCADE`
    - `Parcel` -> `SensorNodes`: `CASCADE`
    - `Parcel` -> `CropScans`: `SET NULL`
    - `User` -> `Fields`: `CASCADE`

- [x] **Subtask 3: EF Core Spatial Migration & PL/pgSQL Area Triggers**
  - Generate migration: `20261015204052_SpatialTablesAndGiSTIndexes`.
  - Implement PL/pgSQL triggers (`calculate_boundary_area` / `calculate_field_area` on `parcels` and `fields`) computing WGS 84 ellipsoidal surface area in hectares (`ST_Area(boundary_geom::geography) / 10000.0`).
  - Export idempotent SQL migration script: `docker/postgres/02-spatial-tables-gist.sql`.
  - Apply migration cleanly via `dotnet ef database update`.

- [x] **Subtask 4: Automated Verification Test Harness (`scripts/verify_spatial_tables.ps1`)**
  - Verify table existence across `fields`, `parcels`, `sensor_nodes`, `crop_scans`, `users`.
  - Verify PostGIS `geometry_columns` registration (`POLYGON:4326` and `POINT:4326`).
  - Verify GiST index installation in `pg_indexes`.
  - Validate automated trigger calculation accuracy (1.00 ha computed vs. exact geodesic formula).
  - Validate Foreign Key deletion cascades (`SensorNodes` deleted on parcel delete; `CropScans` retained with `parcel_id = NULL`).

- [x] **Subtask 5: Formal Completion Report (DoD) & Documentation**
  - Create `PROJECT_DETAILS/Reports/Phase 2/TODO-202-spatial-tables.md`.
  - Update `tasks/todo.md`.
