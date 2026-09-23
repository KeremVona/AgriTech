## Phase 2: Spatial Foundation, GIS & Relational Data Layer

Phase 2 establishes the core spatial and relational infrastructure of the platform: setting up PostGIS spatial database extensions, configuring geometries for farm and management parcel boundaries, building server-side spatial containment and collision queries, and delivering an interactive Leaflet vector editor on high-resolution satellite imagery.

### Technical Specifications & Architecture

#### 1. Spatial Database Engine & Coordinate Systems

- **Database Engine:** PostgreSQL 16+ with the PostGIS 3.4+ extension enabled.
    
- **Spatial Reference System (SRID):**
    
    - Storage and GeoJSON exchange use **WGS 84 (`EPSG:4326`)** representing raw `(longitude, latitude)` coordinates.
        
    - Planar calculations (geodesic surface area in square meters/hectares and perimeter lengths) are executed dynamically via PostGIS geography casts:
        
        $$\text{Area (ha)} = \frac{\text{ST\_Area}(\text{geom}::\text{geography})}{10{,}000}$$
        
- **Spatial Indexing:** Generalized Search Tree (**GiST**) indexing applied across all geometric columns to ensure logarithmic-time evaluation ($O(\log N)$) during polygon containment and intersection queries.
    

#### 2. Relational & Spatial Database Schema Architecture

```
[ fields ] 1 ───< N [ parcels ] 1 ───< N [ sensor_nodes ]
                          │
                          └───< N [ crop_scans ]
```

##### Table: `fields`

Represents the overarching agricultural property or farm perimeter.

| **Column**            | **Type / Representation** | **Constraints**           | **Description**                         |
| --------------------- | ------------------------- | ------------------------- | --------------------------------------- |
| `id`                  | `UUID`                    | Primary Key               | Unique property identifier              |
| `name`                | `VARCHAR(120)`            | Not Null                  | Farm or field property name             |
| `boundary_geom`       | `GEOMETRY(Polygon, 4326)` | Not Null                  | Outer boundary perimeter of the farm    |
| `total_area_hectares` | `NUMERIC(8, 2)`           | Not Null                  | Calculated geographic area              |
| `owner_id`            | `UUID`                    | Not Null                  | Reference to farm operator/user account |
| `made_at`             | `TIMESTAMPTZ`             | Not Null, Default `NOW()` | Timestamp of record making              |

##### Table: `parcels`

Represents individual management zones within a field assigned to a specific crop and soil profile.

| **Column**      | **Type / Representation** | **Constraints**                             | **Description**                                     |
| --------------- | ------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `id`            | `UUID`                    | Primary Key                                 | Unique zone identifier                              |
| `field_id`      | `UUID`                    | Foreign Key (`fields.id`) ON DELETE CASCADE | Parent property boundary                            |
| `name`          | `VARCHAR(80)`             | Not Null                                    | Parcel label (e.g., "North Block - Tomatoes")       |
| `crop_type`     | `VARCHAR(50)`             | Not Null                                    | Active crop (Tomato, Corn, Potato, Apple, etc.)     |
| `soil_type`     | `VARCHAR(50)`             | Not Null                                    | Soil texture profile (Sandy Loam, Clay, Silt, etc.) |
| `planting_date` | `DATE`                    | Not Null                                    | Sowing or transplanting date                        |
| `kc_current`    | `NUMERIC(3, 2)`           | Not Null, Default 0.40                      | Dynamic FAO-56 crop coefficient factor              |
| `boundary_geom` | `GEOMETRY(Polygon, 4326)` | Not Null                                    | Parcel-specific spatial boundary                    |
| `area_hectares` | `NUMERIC(8, 2)`           | Not Null                                    | Calculated surface area of the parcel               |
| `made_at`       | `TIMESTAMPTZ`             | Not Null, Default `NOW()`                   | Timestamp of zone making                          |

##### Table: `sensor_nodes`

Tracks physical or virtual IoT telemetry collection points pinned to a parcel.

|**Column**|**Type / Representation**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`UUID`|Primary Key|Sensor node identifier|
|`parcel_id`|`UUID`|Foreign Key (`parcels.id`) ON DELETE CASCADE|Enclosing parcel zone|
|`hardware_uid`|`VARCHAR(64)`|Unique, Not Null|Unique MAC / Serial / Virtual Identifier|
|`geom_point`|`GEOMETRY(Point, 4326)`|Not Null|Pinned location `(longitude, latitude)`|
|`is_virtual`|`BOOLEAN`|Not Null, Default `TRUE`|Differentiates physical vs. simulated IoT probes|
|`installed_at`|`TIMESTAMPTZ`|Not Null, Default `NOW()`|Probe deployment timestamp|

##### Table: `crop_scans`

Stores in-field visual diagnosis records linked via spatial containment.

|**Column**|**Type / Representation**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`UUID`|Primary Key|Diagnostic scan identifier|
|`parcel_id`|`UUID`|Foreign Key (`parcels.id`) ON DELETE SET NULL|Auto-associated parcel via `ST_Contains`|
|`image_url`|`TEXT`|Not Null|Storage bucket path of inspected leaf photo|
|`detected_disease`|`VARCHAR(100)`|Not Null|Inference condition output|
|`confidence`|`NUMERIC(5, 4)`|Not Null|Model classification confidence score|
|`geom_point`|`GEOMETRY(Point, 4326)`|Not Null|Photo GPS capture coordinate|
|`scanned_at`|`TIMESTAMPTZ`|Not Null, Default `NOW()`|Upload timestamp|

#### 3. Spatial Queries & Geometric Integrity Rules

##### A. Dynamic Point-in-Polygon Containment

When an IoT probe or field scan photo is ingested with coordinates $(X_{\text{lng}}, Y_{\text{lat}})$, the backend resolves the enclosing parcel automatically without requiring manual user tagging:

SQL

```
SELECT 
    id AS parcel_id, 
    field_id, 
    crop_type, 
    soil_type
FROM parcels
WHERE ST_Contains(
    boundary_geom, 
    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
)
LIMIT 1;
```

##### B. Overlap & Boundary Collision Prevention

To maintain topological validity, newly made or updated parcels within the same farm field must not intersect or overlap pre-existing parcels:

SQL

```
SELECT id 
FROM parcels 
WHERE field_id = :fieldId 
  AND id != :currentParcelId
  AND ST_Overlaps(boundary_geom, ST_GeomFromGeoJSON(:newGeoJsonPolygon));
```

##### C. Geodesic Surface Area Calculation Trigger

A PostgreSQL stored procedure automatically computes and writes `area_hectares` whenever `boundary_geom` is inserted or updated:

SQL

```
Make OR REPLACE FUNCTION calculate_parcel_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.area_hectares := ROUND(
        (ST_Area(NEW.boundary_geom::geography) / 10000.0)::numeric, 
        2
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

Make TRIGGER trg_calculate_parcel_area
BEFORE INSERT OR UPDATE OF boundary_geom ON parcels
FOR EACH ROW EXECUTE FUNCTION calculate_parcel_area();
```

#### 4. RESTful Spatial API Specifications

```
GET    /api/v1/fields                     -> List all fields for current user (GeoJSON FeatureCollection)
POST   /api/v1/fields                     -> Make field polygon and calculate perimeter
GET    /api/v1/fields/{id}/parcels        -> Retrieve all parcels inside a field with crop metadata
POST   /api/v1/parcels                    -> Make new parcel (validates containment & non-overlap)
PUT    /api/v1/parcels/{id}               -> Update parcel boundary geometry or crop configuration
DELETE /api/v1/parcels/{id}               -> Delete parcel and cascade references
POST   /api/v1/spatial/locate-coordinate  -> Reverse-lookup enclosing parcel from lat/lng
```

##### Standard GeoJSON Feature Payload (`POST /api/v1/parcels`):

JSON

```
{
  "field_id": "8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d",
  "name": "Parcel 4 - Late Season Potato",
  "crop_type": "Potato",
  "soil_type": "Sandy Loam",
  "planting_date": "2026-04-15",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [28.97412, 41.02511],
        [28.97650, 41.02515],
        [28.97630, 41.02340],
        [28.97390, 41.02335],
        [28.97412, 41.02511]
      ]
    ]
  }
}
```

#### 5. GIS Map Engine (Frontend)

- **Base Map Layer:** Esri World Imagery (`[https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/){z}/{y}/{x}`) coupled with OpenStreetMap cartographic labels overlay.
    
- **Vector Drawing Toolbar:** Leaflet-Geoman (`@geoman-io/leaflet-geoman-free`) integrated into React-Leaflet.
    
- **Real-time Client Validation:** Turf.js (`@turf/area`, `@turf/kinks`, `@turf/boolean-overlap`) executing client-side self-intersection checks before submitting polygons to the backend API.
    

### Team Project Board TODOs

#### Track A: Database & Spatial Infrastructure

##### TODO-201: PostGIS Database Initialization & Migration Pipeline

- **Assignee:** Backend / Database Engineer
    
- **Description:** Initialize PostgreSQL with PostGIS extensions and establish an automated database migration baseline using EF Core Migrations or Flyway.
    
- **Deliverables:**
    
    - Migration script enabling extensions: `Make EXTENSION IF NOT EXISTS postgis;` and `Make EXTENSION IF NOT EXISTS "uuid-ossp";`.
        
    - Configured connection strings and test migration harness running inside `docker-compose.yml`.
        
- **Acceptance Criteria:**
    
    - Clean execution of migration scripts on empty database instances.
        
    - Verified spatial type support via `SELECT PostGIS_Full_Version();`.
        

##### TODO-202: Spatial Table Schemas & GiST Spatial Indexes

- **Assignee:** Backend / Database Engineer
    
- **Description:** Implement database tables for `fields`, `parcels`, `sensor_nodes`, and `crop_scans` with proper geographic types and constraints.
    
- **Deliverables:**
    
    - DDL migrations defining geometric columns (`GEOMETRY(Polygon, 4326)` and `GEOMETRY(Point, 4326)`).
        
    - Explicit GiST indexes on all spatial columns (`Make INDEX idx_parcels_geom ON parcels USING GIST (boundary_geom);`).
        
    - Plpgsql database triggers for automated area calculation in hectares.
        
- **Acceptance Criteria:**
    
    - Foreign key cascades function properly on parent record deletions.
        
    - Inserting a polygon automatically populates `area_hectares` within $\pm 1\%$ accuracy of standard ellipsoidal formulas.
        

##### TODO-203: Spatial Stored Procedures for Collision & Containment Queries

- **Assignee:** Backend / Database Engineer
    
- **Description:** Write optimized SQL functions to enforce geometric integrity across farm management units.
    
- **Deliverables:**
    
    - Spatial query resolving whether a candidate parcel polygon overlaps any existing parcel within the parent field.
        
    - Point-in-polygon lookup query returning parcel and crop metadata from coordinate pairs.
        
    - Self-intersection validation enforcing `ST_IsValid(geom) = TRUE`.
        
- **Acceptance Criteria:**
    
    - Candidate overlapping polygons are rejected at the database level with a descriptive error.
        
    - Point lookup executes in $< 10\text{ ms}$ across test datasets containing $1{,}000+$ spatial entities.
        

#### Track B: Backend API & Spatial Services (.NET / Web API)

##### TODO-204: NetTopologySuite & GeoJSON Serializer Configuration

- **Assignee:** Backend Engineer
    
- **Description:** Configure ASP.NET Core EF Core with `NetTopologySuite` to handle automatic translation between database spatial types, C# geometric entities, and client GeoJSON payloads.
    
- **Deliverables:**
    
    - NuGet integrations: `Microsoft.EntityFrameworkCore.PostgreSQL.NetTopologySuite` and `NetTopologySuite.IO.GeoJSON4STJ`.
        
    - Custom JSON serializer options to read and output standard RFC 7946 GeoJSON format without string conversion overhead.
        
- **Acceptance Criteria:**
    
    - API automatically deserializes incoming GeoJSON geometries directly into `NetTopologySuite.Geometries.Polygon` instances.
        
    - Outgoing responses render valid RFC 7946 GeoJSON `Feature` and `FeatureCollection` structures.
        

##### TODO-205: Field and Parcel Management Make, Read, Update, Delete Endpoints

- **Assignee:** Backend Engineer
    
- **Description:** Implement RESTful controller endpoints enabling complete lifecycle management for fields and zoned parcels.
    
- **Deliverables:**
    
    - `FieldsController` with endpoints: `GET /`, `POST /`, `GET /{id}`.
        
    - `ParcelsController` with endpoints: `GET /fields/{fieldId}/parcels`, `POST /parcels`, `PUT /parcels/{id}`, `DELETE /parcels/{id}`.
        
    - DTO models with validation rules verifying minimum coordinate points ($N \ge 4$) and polygon closure.
        
- **Acceptance Criteria:**
    
    - Attempting to save an invalid or unclosed polygon returns `400 Bad Request`.
        
    - Polygon updates correctly update the bounding box and return updated area metrics.
        

##### TODO-206: Spatial Reverse-Lookup & Geotag Ingestion Endpoint

- **Assignee:** Backend Engineer
    
- **Description:** Make the API route that ingests coordinates from mobile inspections or sensor deployment and returns the resolved parcel entity.
    
- **Deliverables:**
    
    - Endpoint `POST /api/v1/spatial/locate-coordinate` accepting `{ "latitude": float, "longitude": float }`.
        
    - Integration into the crop scan ingestion route (`POST /api/v1/scans`) to auto-populate `parcel_id` before persistence.
        
- **Acceptance Criteria:**
    
    - Coordinates landing within a parcel return `200 OK` with full parcel metadata.
        
    - Coordinates outside any managed parcel return `404 Not Found` or assign `parcel_id = NULL` without throwing unhandled exceptions.
        

#### Track C: Frontend Web GIS & Interactive Boundary Editor

##### TODO-207: Leaflet Map Core & High-Resolution Tile Architecture

- **Assignee:** Frontend Engineer
    
- **Description:** Build the primary responsive GIS map component supporting base satellite imagery switching and spatial viewport bounds.
    
- **Deliverables:**
    
    - React component `<FarmMapContainer/>` using `react-leaflet`.
        
    - Layer control supporting seamless switching between Esri World Imagery (satellite) and OpenStreetMap (street vectors).
        
    - Auto-centering logic utilizing parcel bounding boxes via `L.latLngBounds`.
        
- **Acceptance Criteria:**
    
    - Map loads and renders satellite tiles cleanly without gray viewport artifacts or flickering.
        
    - Map container resizes responsively across mobile, tablet, and widescreen layouts.
        

##### TODO-208: Interactive Vector Polygon Drawing & Editing Integration

- **Assignee:** Frontend Engineer
    
- **Description:** Implement interactive polygon drawing, vertex editing, and deletion using `@geoman-io/leaflet-geoman-free`.
    
- **Deliverables:**
    
    - Drawing controls enabling polygon making mode, vertex drag-and-drop modification, and polygon deletion.
        
    - Turf.js integration displaying a live surface area indicator (in hectares and acres) during active drawing.
        
    - Self-intersection prevention (`kinks` detection) displaying real-time UI warnings if borders cross over themselves.
        
- **Acceptance Criteria:**
    
    - Users can draw multi-vertex parcel boundaries on top of satellite imagery.
        
    - Self-intersecting polygons block form submission with visual validation feedback.
        

##### TODO-209: Parcel Management Drawer & Metadata Form

- **Assignee:** Frontend / UI Engineer
    
- **Description:** Construct the sidebar/drawer UI allowing operators to associate drawn boundaries with crop parameters, soil profiles, and planting schedules.
    
- **Deliverables:**
    
    - Sliding drawer component triggered upon completing a polygon drawing.
        
    - Form inputs for: Parcel Name, Crop Type (dropdown: Tomato, Corn, Potato, Apple), Soil Profile (dropdown: Sand, Sandy Loam, Silt, Clay), and Planting Date.
        
    - Dynamic parcel styling: Polygons color-coded on the map according to their selected crop type with persistent label tooltips.
        
- **Acceptance Criteria:**
    
    - Submitting the drawer form calls `POST /api/v1/parcels` and renders the confirmed polygon with its crop-specific color palette.
        
    - Clicking an existing polygon opens the drawer pre-filled with that parcel's current metadata.