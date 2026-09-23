## Phase 6: Full Integration, Telemetry Dashboard & Mobile Polish

Phase 6 unifies all microservices, geometric layers, telemetry streams, and analytical viewers into a single spatial farm dashboard and progressive mobile inspection interface. It bridges field workers capturing geotagged leaf samples with desktop farm operators monitoring irrigation schedules, valve states, disease outbreak clusters, and macro climate vulnerabilities. In addition, this phase implements presentation and evaluation controls ("Demo Triggers") that allow the project team to simulate environmental stress, moisture drops, and outbreak events on demand during project defense.

### Technical Specifications & Architecture

#### 1. Unified Spatial Map & Dynamic Layer Hierarchy

The primary dashboard consolidates all spatial vectors into an interactive map interface using Leaflet / Mapbox GL:

```
+-----------------------------------------------------------------------------------+
| Leaflet Multi-Layer Canvas                                                        |
|                                                                                   |
|  [Layer 0] High-Resolution Satellite Basemap (Esri World Imagery)                 |
|       │                                                                           |
|  [Layer 1] Parcel Polygon Boundaries (GeoJSON, color-coded by crop type)          |
|       │                                                                           |
|  [Layer 2] Disease Risk Heatmap / Density Surface (Supercluster / Leaflet.heat)   |
|       │                                                                           |
|  [Layer 3] Geotagged Scan Markers (Color-coded by severity, clickable cards)     |
|       │                                                                           |
|  [Layer 4] Sensor Node Probes (Real-time VWC% badges & battery indicators)        |
|       │                                                                           |
|  [Layer 5] Active Irrigation Actuators (Animated pulse rings over active valves)  |
+-----------------------------------------------------------------------------------+
```

- **Dynamic Layer Switching:** Operators can independently toggle the visibility of:
    
    1. Parcel boundaries and crop labels.
        
    2. Soil moisture sensor overlays.
        
    3. Disease outbreak point clusters and spatial risk density.
        
    4. Active irrigation valve rings.
        
- **Real-time Event Streaming:** The client establishes a WebSocket / SignalR connection to the backend gateway to receive live telemetry ticks, valve state transitions, and incoming field scan notifications without full page reloads.
    

#### 2. Mobile Progressive Web App (PWA) Field Inspection Pipeline

Designed for field workers operating on mobile browsers under outdoor field conditions:

```
[ Mobile Browser / PWA ]
       │
       ├── 1. In-Field Photo Capture (<input type="file" capture="environment">)
       │
       ├── 2. Coordinate Extraction (EXIF GPS metadata || navigator.geolocation)
       │
       ├── 3. Multipart Upload: Image + (Latitude, Longitude)
       ▼
[ Core Web API Gateway ]
       │
       ├── 4. Spatial Parcel Lookup (ST_Contains on PostGIS)
       │
       ├── 5. Forward to Vision Microservice (POST /api/v1/classify-leaf)
       │
       ├── 6. Record Scan in DB (crop_scans table)
       ▼
[ Real-Time Broadcast (WebSocket / SignalR) ]
       │
       └── Push Scan Marker -> Farm Admin Dashboard Leaflet Map
```

- **Hardware Geolocation Fallback:**
    
    - Primary: Parse embedded EXIF GPS tags from original camera capture using `exifr`.
        
    - Fallback 1: Query browser `navigator.geolocation.getCurrentPosition` with high accuracy enabled.
        
    - Fallback 2: Allow manual "tap-to-pin" on the interactive parcel map if GPS accuracy exceeds $\pm 25\text{ m}$.
        

#### 3. Disease Clustering & Outbreak Spatial Risk Engine

To identify pathogen propagation fronts across parcel borders:

- **Spatial Gating:** Filter scans where `confidence_score >= 0.70` and `severity_level` in `['MODERATE', 'CRITICAL']`.
    
- **Clustering Algorithm:** Implement server-side spatial clustering using PostGIS `ST_ClusterDBSCAN`:
    
    SQL
    
    ```
    SELECT 
        id,
        parcel_id,
        detected_disease,
        confidence,
        geom_point,
        ST_ClusterDBSCAN(geom_point::geography, eps := 50, minpoints := 3) OVER () AS cluster_id
    FROM crop_scans
    WHERE scanned_at >= NOW() - INTERVAL '14 days'
      AND detected_disease NOT LIKE '%healthy%';
    ```
    
    - `eps := 50`: Proximity search radius of 50 meters.
        
    - `minpoints := 3`: Minimum of 3 positive disease infections to flag an active pathogen cluster.
        
- **Outbreak Severity Index ($S_{\text{zone}}$):** Parcels containing active clusters are assigned an elevated spatial disease risk, alerting the operator to restrict overhead watering to prevent spore dispersal.
    

#### 4. Presentation & Evaluation Control Fixtures ("Demo Triggers")

To ensure bulletproof, repeatable live demonstrations without depending on natural 24-hour weather or soil drying cycles, an evaluator control panel allows instant injection of deterministic edge cases:

|**Trigger Action**|**Injected State / Parameters**|**Observable System Reaction**|
|---|---|---|
|**"Accelerate Moisture Depletion"**|Forces virtual soil moisture down to $14.2\%$ (below MAD threshold)|Triggers automated water balance calculation, updates depletion gauge to Red, and issues simulated `VALVE_TRIGGER_OPEN` command within 5 seconds.|
|**"Inject Late Blight Outbreak"**|Injects 5 geotagged _Phytophthora infestans_ scans along a parcel perimeter|DBSCAN cluster trips; red outbreak heatmap envelope appears on the GIS map; overhead irrigation on that parcel is locked out.|
|**"Force Regional Heatwave"**|Overrides Open-Meteo cache with $T_{\max} = 42^\circ\text{C}, RH = 18\%, \text{CDD} = 30$|Flips Southeast Anatolia (Güneydoğu Anadolu) risk polygon to Red on the Türkiye map with severe drought stress advisories.|
|**"Inject Sudden Cold Snap"**|Overrides overnight minimum to $-4.5^\circ\text{C}$ during active bud development|Frost risk engine trips $R_{\text{frost}} = 100\%$; triggers emergency orchard frost warning banner.|

### Team Project Board TODOs

#### Track A: End-to-End Orchestration & Mobile Field Inspection (PWA)

##### TODO-601: Mobile PWA Camera Capture & EXIF/GPS Extraction

- **Assignee:** Frontend Engineer
    
- **Description:** Implement the mobile field inspection camera flow supporting direct device capture and automated location resolution.
    
- **Deliverables:**
    
    - Responsive mobile view `<MobileFieldScanner/>` with HTML5 camera input (`capture="environment"`).
        
    - Metadata extraction pipeline reading embedded EXIF GPS tags via `exifr`.
        
    - Fallback geolocation resolver pulling device coordinates with an accuracy indicator.
        
- **Acceptance Criteria:**
    
    - Taking a photo on iOS Safari or Android Chrome extracts latitude and longitude within $\pm 10\text{ m}$.
        
    - If GPS permissions are denied, an intuitive map modal prompts the worker to pin the photo location manually.
        

##### TODO-602: In-Field Scan Ingestion & Real-Time Farm Map Marker Drop

- **Assignee:** Backend Engineer
    
- **Description:** Connect the mobile photo submission pipeline through the gateway to the ML classifier, persist the scan, and link it via spatial containment.
    
- **Deliverables:**
    
    - Gateway route `POST /api/v1/scans` accepting multipart image and coordinate payload.
        
    - Spatial association assigning `parcel_id` via `ST_Contains(boundary_geom, geom_point)`.
        
    - SignalR / WebSocket event hub broadcasting `OnNewScanIngested` to connected dashboard clients.
        
- **Acceptance Criteria:**
    
    - Scan saves to PostgreSQL with accurate parcel association in $< 350\text{ ms}$ total roundtrip.
        
    - Dashboard Leaflet map immediately places an animated pin at the inspection coordinates without browser refresh.
        

##### TODO-603: Real-Time Event Hub & WebSocket Gateway

- **Assignee:** Backend Engineer
    
- **Description:** Establish a bi-directional messaging hub to push live telemetry updates, valve state changes, and emergency agronomic alerts to the frontend.
    
- **Deliverables:**
    
    - ASP.NET Core SignalR hub `TelemetryHub` (or WebSocket server) managing topic subscriptions per farm property.
        
    - Integration with MQTT consumer pushing real-time soil moisture ticks directly to client browsers.
        
    - Heartbeat mechanism handling mobile reconnection gracefully.
        
- **Acceptance Criteria:**
    
    - Telemetry updates render on the frontend within $100\text{ ms}$ of being ingested from MQTT.
        
    - Zero orphaned socket connections during network disconnects.
        

#### Track B: Unified Spatial Map Overlays & Analytics Engine

##### TODO-604: Unified Spatial Map Multi-Layer Dashboard

- **Assignee:** Frontend Engineer
    
- **Description:** Integrate parcel geometries, active sensor nodes, valve states, and scan markers into a unified, layer-switched GIS workspace.
    
- **Deliverables:**
    
    - Leaflet layer control panel allowing independent toggling of: Parcels, Telemetry Nodes, Disease Points, and Valve Overlays.
        
    - Interactive marker popups displaying sensor readings (VWC%, temperature) and recent scan summaries with thumbnail previews.
        
    - Actuation visualizer rendering pulsing green rings over parcels where automated irrigation is currently active.
        
- **Acceptance Criteria:**
    
    - Map remains performant ($\ge 50\text{ FPS}$) with $200+$ active vector and point entities rendered simultaneously.
        
    - Toggling layers updates the canvas instantly without re-fetching static boundaries.
        

##### TODO-605: Disease Outbreak Point Clustering & Spatial Risk Density Heatmap

- **Assignee:** Backend / GIS Engineer
    
- **Description:** Implement spatial density clustering to aggregate individual foliar scans into clear contagion hotspots and high-risk zones.
    
- **Deliverables:**
    
    - Backend spatial query running DBSCAN clustering over rolling 14-day scans.
        
    - Frontend cluster layer grouping adjacent infection points with numbered severity badges.
        
    - Dynamic warning indicator on parcel metadata cards flagging "Outbreak Contagion Warning" when cluster density exceeds thresholds.
        
- **Acceptance Criteria:**
    
    - 3 or more infections within a 50-meter radius automatically form a visible outbreak cluster.
        
    - Healthy leaf scans do not contribute to disease outbreak clustering density.
        

##### TODO-606: 14-Day Integrated Telemetry & Water Balance Analytics Dashboard

- **Assignee:** Frontend Engineer
    
- **Description:** Build the primary farm operations chart showing the historical interplay between soil moisture loss, rainfall events, and automated valve actuations.
    
- **Deliverables:**
    
    - Multi-axis chart component `<WaterBalanceAnalytics parcelId="{id}"/>` using Recharts or Chart.js.
        
    - Synchronized visualization:
        
        - Line Series: Volumetric Water Content (%) with Field Capacity and MAD reference lines.
            
        - Bar Series (Top): Effective Rainfall ($P_{\text{eff}}$ in mm).
            
        - Bar Series (Bottom): Irrigation Volume Delivered (Liters).
            
- **Acceptance Criteria:**
    
    - Chart clearly demonstrates moisture rebound directly following automated irrigation bars.
        
    - Tooltips display exact water volumes, duration in minutes, and weather parameters on hover.
        

#### Track C: Presentation Fixtures, Demo Triggers & System Hardening

##### TODO-607: Capstone "Demo Trigger" Simulation Control Panel

- **Assignee:** Full-Stack Engineer
    
- **Description:** Construct a secret/admin modal enabling presenters to simulate sensor anomalies, drought waves, and sudden disease outbreaks during capstone evaluation.
    
- **Deliverables:**
    
    - Floating debug menu `<DemoTriggerPanel/>` accessible via hotkey (`Ctrl + Shift + D`) or admin toggle.
        
    - Action buttons:
        
        - `Trigger Soil Moisture Deficit`: Forces virtual sensor to $14\%$, triggering immediate automated irrigation.
            
        - `Inject Late Blight Cluster`: Makes 4 severe infection points in Parcel 1.
            
        - `Simulate Regional Drought`: Injects extreme weather parameters into Central Anatolia.
            
        - `Reset Baseline State`: Restores normal operating conditions.
            
- **Acceptance Criteria:**
    
    - Triggering an action reflects on the map, telemetry charts, and actuator logs within 5 seconds without restarting backend processes.
        
    - Evaluators can observe live cause-and-effect across the entire system architecture in real time.
        

##### TODO-608: Idempotent Database Seed Scripts & Evaluation Scenarios

- **Assignee:** Database / Backend Engineer
    
- **Description:** Make reliable seed scripts that populate complete farm profiles, realistic 14-day telemetry logs, historical scans, and regional boundaries for presentation day.
    
- **Deliverables:**
    
    - Database CLI command `dotnet run --seed` or `npm run db:seed`.
        
    - Preloaded scenario: 1 Demonstration Farm (Bursa / Marmara) containing 4 parcels (Tomato, Corn, Potato, Apple) with 14 days of realistic diurnal sensor curves and sample scans.
        
    - Preloaded regional risk boundaries covering all 81 provinces of Türkiye.
        
- **Acceptance Criteria:**
    
    - Seed script executes idempotently in $< 15\text{ seconds}$ on a fresh PostgreSQL container.
        
    - Produces a fully populated, visually engaging dashboard with zero empty states on first launch.
        

##### TODO-609: Production Docker Composition, Health Probes & Backup Demo Assets

- **Assignee:** DevOps Engineer
    
- **Description:** Package all services into an orchestrated Docker Compose environment and prepare offline backup assets in accordance with evaluation best practices.
    
- **Deliverables:**
    
    - Single-command deployment file `docker-compose.prod.yml` coordinating: Web Client, ASP.NET Core API Gateway, Python Vision Service, Mosquitto MQTT Broker, and PostGIS Database.
        
    - Automated container health dependencies (`depends_on` with `condition: service_healthy`).
        
    - Offline fallback recording: A high-bitrate 3-minute video walk-through demonstrating every user journey (PWA photo upload, 3D anatomy explorer, automated valve trigger, and Türkiye risk map) stored locally on the presentation laptop.
        
- **Acceptance Criteria:**
    
    - Complete platform boots and reaches steady state via `docker compose up -d` within 45 seconds on an unprovisioned machine.
        
    - System operates fully offline in local simulation mode if university venue internet connectivity fails on presentation day.