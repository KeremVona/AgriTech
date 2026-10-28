# TODO-205: Field and Parcel Management RESTful Endpoints

## Current Status: COMPLETED
**Branch:** `feat/backend-todo205-field-parcel-crud`  
**Assignee:** Backend Engineer  
**Phase:** Phase 2 — Spatial Foundation, GIS & Relational Data Layer  

---

- [x] **Subtask 1: Spatial Validation Layer (`ValidPolygonAttribute.cs`)**
  - Custom DataAnnotations attribute validating NetTopologySuite `Polygon` instances.
  - Enforces minimum coordinate count $N \ge 4$ (3 distinct vertices + 1 closure point).
  - Enforces ring closure (`Coordinates[0] == Coordinates[^1]`).
  - Enforces topological validity via `polygon.IsValid` (rejecting self-intersecting butterfly polygons).
  - Short-circuits with `400 Bad Request` before database interaction.

- [x] **Subtask 2: Strongly-Typed DTO Models (`Models/DTOs/`)**
  - Created `BoundingBoxDto.cs` computing standard RFC 7946 `[minLng, minLat, maxLng, maxLat]` envelope in-process.
  - Created `FieldDtos.cs` (`CreateFieldRequest`, `UpdateFieldRequest`, `FieldResponseDto`, `ParcelSummaryDto`).
  - Created `ParcelDtos.cs` (`CreateParcelRequest`, `UpdateParcelRequest`, `ParcelResponseDto`).
  - Created `SpatialMappingExtensions.cs` centralizing entity-to-DTO projection with BBOX calculation.

- [x] **Subtask 3: FieldsController Implementation (`FieldsController.cs`)**
  - `GET /api/v1/fields` — Lists farm fields with parcel counts and bounding boxes.
  - `POST /api/v1/fields` — Validates owner, persists boundary polygon, triggers automatic `total_area_hectares` calculation via DB trigger, returns `201 Created`.
  - `GET /api/v1/fields/{id}` — Returns field detail with embedded parcel summaries and bounding box.

- [x] **Subtask 4: ParcelsController Implementation (`ParcelsController.cs`)**
  - `GET /api/v1/fields/{fieldId}/parcels` — Returns all parcels in a field as an RFC 7946 GeoJSON `FeatureCollection`.
  - `POST /api/v1/parcels` — Validates parent field, crop, and soil profile; enforces spatial containment inside field (`ST_Covers`); detects candidate parcel overlap via `fn_check_parcel_overlap` (`409 Conflict`); triggers automatic `area_hectares` calculation; returns `201 Created`.
  - `PUT /api/v1/parcels/{id}` — Partial updates for metadata and/or geometry; recalculates bounding box and area metrics upon geometry update; returns `200 OK`.
  - `DELETE /api/v1/parcels/{id}` — Deletes parcel; enforces DB cascade (`SensorNodes` cascade, `CropScans` set null); returns `204 No Content`.

- [x] **Subtask 5: Global Exception Handling for Spatial Parsing (`Program.cs`)**
  - Configured middleware catching `ArgumentException` and `TopologyException` during request body deserialization.
  - Automatically translates NetTopologySuite unclosed ring errors into RFC 7807 `400 Bad Request`.

- [x] **Subtask 6: Automated Verification Test Harness (`scripts/verify_field_parcel_crud.ps1`)**
  - Automated PowerShell test harness executing 7 validation test cases:
    - Test 1: $N < 4$ coordinates rejected -> `400 Bad Request` -> PASS.
    - Test 2: Unclosed polygon ring rejected -> `400 Bad Request` -> PASS.
    - Test 3: Self-intersecting butterfly polygon rejected -> `400 Bad Request` -> PASS.
    - Test 4: Create field -> `201 Created` with BBOX and DB-computed area -> PASS.
    - Test 5: Create parcel inside field -> `201 Created` with BBOX and DB-computed area -> PASS.
    - Test 6: Update parcel boundary -> BBOX and area updated -> PASS.
    - Test 7: Delete parcel -> `204 No Content` with FK cascade verification -> PASS.

- [x] **Subtask 7: Formal Completion Report (DoD) & Documentation**
  - Created `PROJECT_DETAILS/Reports/Phase 2/TODO-205-field-parcel-management.md`.
  - Updated `tasks/todo.md`.
