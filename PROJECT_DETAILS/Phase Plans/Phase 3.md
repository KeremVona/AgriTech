## Phase 3: Telemetry Simulator & Dynamic FAO-56 Irrigation Engine

Phase 3 implements the environmental ingestion, biological math modeling, and automated actuation layers of the platform. This phase connects the system to external meteorological models, calculates crop-specific soil water depletion using the FAO-56 Penman-Monteith framework, simulates virtual field IoT sensors with daily diurnal cycles, and dispatches automated valve actuation events when soil moisture crosses critical depletion thresholds.

### Technical Specifications & Architecture

#### 1. Open-Meteo Ingestion Pipeline & Weather Cache

To eliminate high API operational costs while maintaining high-resolution environmental inputs, the system queries the Open-Meteo Forecast and Historical Weather APIs.

- **Spatial Resolution:** For each parcel, compute the geographic centroid $(\text{Centroid}_X, \text{Centroid}_Y)$ via PostGIS:
    
    SQL
    
    ```
    SELECT ST_X(ST_Centroid(boundary_geom)) AS lng, ST_Y(ST_Centroid(boundary_geom)) AS lat 
    FROM parcels WHERE id = :parcelId;
    ```
    
- **Queried Parameters (Daily & Hourly):**
    
    - `et0_fao_evapotranspiration` (mm/day)
        
    - `precipitation` (mm)
        
    - `temperature_2m_max`, `temperature_2m_min` (°C)
        
    - `relative_humidity_2m` (%)
        
    - `shortwave_radiation_sum` ($\text{MJ}/\text{m}^2$)
        
    - `wind_speed_10m` (m/s)
        
- **Ingestion Schedule & Caching:** Ingestion runs once every 24 hours at 00:05 UTC to pull the trailing 24 hours of observed data and a 7-day rolling forecast. Forecast snapshots are persisted to `weather_cache` to serve predictive water budgets without hitting API rate limits.
    

#### 2. Agronomic Math Model: Dynamic FAO-56 Soil Water Balance

##### A. Crop Evapotranspiration ($ET_c$) & Staged Crop Coefficients ($K_c$)

Crop water demand varies dynamically across phenological development stages:

$$ET_c = K_c(t) \times ET_0$$

The crop coefficient $K_c(t)$ is computed by determining the Days After Planting ($\text{DAP} = t - t_{\text{plant}}$):

|**Stage**|**Duration (DAP)**|**Kc​ Calculation**|**Description**|
|---|---|---|---|
|**Initial Stage** ($L_{\text{ini}}$)|$0 \le \text{DAP} < L_{\text{ini}}$|$K_{c} = K_{c,\text{ini}}$|Seed germination to 10% canopy cover|
|**Development** ($L_{\text{dev}}$)|$L_{\text{ini}} \le \text{DAP} < L_{\text{ini}} + L_{\text{dev}}$|$K_{c}(t) = K_{c,\text{ini}} + \left(\frac{\text{DAP} - L_{\text{ini}}}{L_{\text{dev}}}\right)(K_{c,\text{mid}} - K_{c,\text{ini}})$|10% to 70–80% effective ground cover|
|**Mid-Season** ($L_{\text{mid}}$)|$L_{\text{prev}} \le \text{DAP} < L_{\text{prev}} + L_{\text{mid}}$|$K_{c} = K_{c,\text{mid}}$|Flowering, fruit set, and yield formation|
|**Late Season** ($L_{\text{late}}$)|$L_{\text{prev}} \le \text{DAP} \le \text{Harvest}$|$K_{c}(t) = K_{c,\text{mid}} - \left(\frac{\text{DAP} - L_{\text{prev}}}{L_{\text{late}}}\right)(K_{c,\text{mid}} - K_{c,\text{end}})$|Ripening, leaf senescence, and maturity|

_Standard Crop Constants Configuration ($K_{c,\text{ini}} \to K_{c,\text{mid}} \to K_{c,\text{end}}$):_

- **Tomato:** $0.60 \to 1.15 \to 0.80$ ($L: 30, 40, 45, 30\text{ days}$)
    
- **Potato:** $0.50 \to 1.15 \to 0.75$ ($L: 25, 30, 45, 30\text{ days}$)
    
- **Corn:** $0.30 \to 1.20 \to 0.35$ ($L: 20, 35, 40, 30\text{ days}$)
    
- **Apple:** $0.45 \to 0.95 \to 0.70$ (Perennial leaf-out cycle)
    

##### B. Soil Moisture Deficit & Root-Zone Capacity

Water retention depends on the parcel's configured `soil_type`:

- $\theta_{\text{FC}}$: Volumetric water content at Field Capacity ($\text{m}^3/\text{m}^3$).
    
- $\theta_{\text{WP}}$: Volumetric water content at Permanent Wilting Point ($\text{m}^3/\text{m}^3$).
    
- $Z_r$: Effective rooting depth (m), modeled dynamically based on crop maturity.
    

$$\text{Total Available Water (TAW)} = 1000 \cdot (\theta_{\text{FC}} - \theta_{\text{WP}}) \cdot Z_r \quad (\text{mm})$$

$$\text{Readily Available Water (RAW)} = p \cdot \text{TAW} \quad (\text{mm})$$

_where $p \in [0.3, 0.6]$ is the Management Allowed Depletion (MAD) fraction._

##### C. Daily Water Balance Equation

Daily root-zone depletion $D_r$ advances according to:

$$D_{r, t} = \max\Big(0, \, D_{r, t-1} - P_{\text{eff}, t} - I_t + ET_{c, t} + \text{DP}_t\Big)$$

- $P_{\text{eff}, t}$: Effective rainfall ($\text{mm}$), eliminating runoff: $P_{\text{eff}} = \max(0, (P - 5) \times 0.75)$.
    
- $I_t$: Irrigation depth delivered to the root zone ($\text{mm}$).
    
- $\text{DP}_t$: Deep percolation loss beyond the root zone when moisture exceeds field capacity ($D_{r} < 0$).
    

##### D. Actuation Trigger Logic

- **Condition:** When cumulative root-zone water depletion reaches readily available water:
    
    $$D_{r, t} \ge \text{RAW}$$
    
- **Water Volume Calculation:** Compute the gross water volume required to refill the root zone back to Field Capacity ($D_r = 0$), factoring in drip irrigation system application efficiency ($\eta \approx 0.88$):
    
    $$\text{Volume (Liters)} = \frac{D_{r, t} \cdot \text{Area (m}^2\text{)}}{\eta}$$
    
    $$\text{Valve Open Duration (min)} = \frac{\text{Volume}}{\text{System Flow Rate (L/min)}}$$
    

#### 3. Simulated IoT Architecture & MQTT Infrastructure

```
  [ Background Simulation Engine ] (Ticks every simulated hour)
              │
              ├── Calculate ETc decay & environmental drainage
              ├── Update virtual sensor registers (VWC%, Temp, Battery)
              ▼
  [ MQTT Publisher (Client) ]
              │
              │  Topic: agri/telemetry/{parcel_id}
              ▼
    [ Eclipse Mosquitto MQTT Broker ]
              │
              ├── Topic: agri/telemetry/#
              ▼
  [ Backend Telemetry Consumer (HostedService / Worker) ]
              │
              ├── Persist to DB: sensor_telemetry (Time-Series)
              ├── Evaluate MAD depletion trigger condition
              │
              └── IF (Depletion >= RAW):
                    │
                    ├── Insert irrigation_events (Status: Scheduled/Active)
                    └── Publish Valve Command: agri/actuator/{parcel_id}/valve
```

##### Telemetry Payload Format (`agri/telemetry/{parcel_id}`):

JSON

```
{
  "node_id": "sim-node-7b2c-01",
  "parcel_id": "8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d",
  "timestamp": "2026-09-21T14:00:00Z",
  "soil_moisture_pct": 24.3,
  "soil_temperature_c": 19.8,
  "ambient_humidity_pct": 52.1,
  "battery_voltage": 3.94
}
```

##### Actuation Command Payload (`agri/actuator/{parcel_id}/valve`):

JSON

```
{
  "event_id": "4b6c8e1a-9f20-41da-bc33-8a9d12345678",
  "parcel_id": "8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d",
  "action": "VALVE_TRIGGER_OPEN",
  "duration_seconds": 1800,
  "target_volume_liters": 14200.0,
  "reason": "MAD_EXCEEDED_DEFICIT_RECOVERY"
}
```

#### 4. Additional Database Tables & Migrations

##### Table: `soil_profiles`

Provides physical hydrological reference constants by soil texture class.

|**Column**|**Type**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`VARCHAR(40)`|Primary Key|e.g., `sandy_loam`, `clay`, `silt_loam`|
|`field_capacity_pct`|`NUMERIC(4, 3)`|Not Null|$\theta_{\text{FC}}$ volumetric water percentage|
|`wilting_point_pct`|`NUMERIC(4, 3)`|Not Null|$\theta_{\text{WP}}$ volumetric water percentage|
|`saturation_pct`|`NUMERIC(4, 3)`|Not Null|Maximum porosity capacity|
|`hydraulic_conductivity`|`NUMERIC(6, 2)`|Not Null|Drainage rate in mm/hour|

##### Table: `weather_cache`

Stores cached external meteorological feeds to minimize redundant API traffic.

|**Column**|**Type**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`UUID`|Primary Key|Cache record identifier|
|`parcel_id`|`UUID`|Foreign Key (`parcels.id`)|Centroid-linked parcel|
|`forecast_date`|`DATE`|Not Null|Target observation/forecast day|
|`et0_mm`|`NUMERIC(5, 2)`|Not Null|Reference evapotranspiration|
|`precipitation_mm`|`NUMERIC(5, 2)`|Not Null|Ingested precipitation|
|`temp_min_c`|`NUMERIC(4, 1)`|Not Null|Minimum daily temperature|
|`temp_max_c`|`NUMERIC(4, 1)`|Not Null|Maximum daily temperature|
|`ingested_at`|`TIMESTAMPTZ`|Not Null|Fetch timestamp|

##### Table: `sensor_telemetry`

High-throughput time-series table indexed for rapid analytical querying.

|**Column**|**Type**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`BIGSERIAL`|Primary Key|Sequential row identifier|
|`parcel_id`|`UUID`|Foreign Key (`parcels.id`)|Target spatial parcel|
|`node_id`|`VARCHAR(64)`|Not Null|Hardware or simulated node UID|
|`timestamp`|`TIMESTAMPTZ`|Not Null|Log capture timestamp|
|`soil_moisture_pct`|`NUMERIC(5, 2)`|Not Null|Volumetric soil moisture percentage|
|`soil_temp_c`|`NUMERIC(4, 2)`|Not Null|Soil temperature in °C|
|`battery_level_v`|`NUMERIC(3, 2)`|Not Null|Node battery health|

##### Table: `irrigation_events`

Tracks complete valve actuation lifecycle from trigger to completion.

|**Column**|**Type**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`UUID`|Primary Key|Event record identifier|
|`parcel_id`|`UUID`|Foreign Key (`parcels.id`)|Associated parcel|
|`trigger_type`|`VARCHAR(30)`|Not Null|`AUTOMATED_DEFICIT`, `MANUAL_OVERRIDE`|
|`status`|`VARCHAR(20)`|Not Null|`PENDING`, `IN_PROGRESS`, `COMPLETED`, `ABORTED`|
|`scheduled_start`|`TIMESTAMPTZ`|Not Null|Target start time|
|`actual_start`|`TIMESTAMPTZ`|Nullable|Exact actuation timestamp|
|`duration_minutes`|`INTEGER`|Not Null|Valve open duration|
|`water_volume_liters`|`NUMERIC(10, 2)`|Not Null|Delivered water quantity|

### Team Project Board TODOs

#### Track A: Agronomic Logic & Weather Ingestion Engine

##### TODO-301: Open-Meteo Weather Client & Daily Ingestion Job

- **Assignee:** Backend Engineer
    
- **Description:** Implement an HTTP client and scheduled background job to fetch 7-day rolling meteorological metrics from Open-Meteo based on parcel centroids.
    
- **Deliverables:**
    
    - Typed client `OpenMeteoClient` consuming `/v1/forecast` with parameters: `et0_fao_evapotranspiration`, `precipitation`, `temperature_2m_max`, `temperature_2m_min`.
        
    - Scheduled task running daily via `IHostedService` or Hangfire that reads parcel centroids, executes external calls, and writes entries to `weather_cache`.
        
    - Resilience policy using Polly handling rate-limiting (HTTP 429) with exponential backoff and jitter.
        
- **Acceptance Criteria:**
    
    - System ingests and caches 7 days of forecast data per parcel without duplicating records.
        
    - API network failure automatically retries up to 3 times before logging a critical error.
        

##### TODO-302: FAO-56 Dynamic Crop Coefficient ($K_c$) Calculator

- **Assignee:** Backend / Agronomy Lead
    
- **Description:** Implement the phenological development stage engine that determines current $K_c$ based on crop type, planting date, and current date.
    
- **Deliverables:**
    
    - Static configuration file `crop_growth_stages.json` defining initial, development, mid-season, and late-season day lengths and $K_c$ values for Tomato, Corn, Potato, and Apple.
        
    - Service `CropPhenologyService` with method: `CalculateCurrentKc(cropType, plantingDate, targetDate)`.
        
    - Comprehensive unit test suite validating $K_c$ interpolation across every transition point in the crop lifecycle.
        
- **Acceptance Criteria:**
    
    - Mid-season crops resolve to their peak $K_c$ plateau (e.g., Tomato mid-season = 1.15).
        
    - Linear transitions between $L_{\text{ini}} \to L_{\text{mid}}$ and $L_{\text{mid}} \to L_{\text{late}}$ compute smoothly with no stepped discontinuity.
        

##### TODO-303: Root-Zone Water Deficit & Actuation Trigger Service

- **Assignee:** Backend Engineer
    
- **Description:** Implement the soil water balance algorithm that computes daily depletion, checks against Management Allowed Depletion (MAD), and schedules watering events.
    
- **Deliverables:**
    
    - Service `IrrigationSchedulingEngine` executing:
        
        $$D_{r, t} = D_{r, t-1} + ET_c - P_{\text{eff}} - I$$
        
    - Soil hydraulic parameters lookup linking `soil_profiles` to calculate parcel-specific RAW (Readily Available Water).
        
    - Actuation evaluation: triggers an automated irrigation record when $D_r \ge \text{RAW}$.
        
- **Acceptance Criteria:**
    
    - Simulated rain events ($P > 5\text{ mm}$) reduce calculated root-zone depletion accordingly.
        
    - Irrigation volumes generated precisely match the millimeters required to return soil moisture to 100% of Field Capacity.
        

#### Track B: IoT Simulator, MQTT Infrastructure & Valve Actuator

##### TODO-304: MQTT Broker Setup & Messaging Contract Configuration

- **Assignee:** DevOps / Backend Engineer
    
- **Description:** Deploy an Eclipse Mosquitto MQTT broker container and configure secure credentials and internal messaging contracts.
    
- **Deliverables:**
    
    - `mosquitto.conf` configured with mutual authentication or restricted internal network access inside Docker Compose.
        
    - Standardized MQTT topics structure: `agri/telemetry/{parcelId}` and `agri/actuator/{parcelId}/valve`.
        
    - MQTT client integration in ASP.NET Core using `MQTTnet` library with auto-reconnect logic.
        
- **Acceptance Criteria:**
    
    - Broker successfully starts in Docker with port `1883` accessible internally.
        
    - Backend establishes persistent subscription to wildcard topic `agri/telemetry/#`.
        

##### TODO-305: Virtual Soil Sensor Telemetry Simulator

- **Assignee:** Backend Engineer
    
- **Description:** Build a background simulation service that models realistic hourly soil moisture loss, diurnal temperature cycles, and battery discharge.
    
- **Deliverables:**
    
    - Worker service `SoilTelemetrySimulatorWorker` running an internal clock ticking every 5–60 simulated minutes.
        
    - Diurnal temperature generator using sinusoidal daytime heating and nighttime cooling:
        
        $$T(t) = T_{\text{avg}} + \Delta T \cdot \sin\left(\frac{2\pi(t - 9)}{24}\right)$$
        
    - Moisture decay algorithm reducing volumetric water content dynamically based on calculated hourly $ET_c$.
        
    - MQTT publisher pushing sensor telemetry packets directly to Mosquitto.
        
- **Acceptance Criteria:**
    
    - Virtual soil moisture decreases continuously during daylight hours and stabilizes at night.
        
    - Packets publish consistently without memory leaks over 24-hour simulation loops.
        

##### TODO-306: Valve Actuator Controller & Telemetry Ingestion Consumer

- **Assignee:** Backend Engineer
    
- **Description:** Implement the background consumer that ingests sensor messages into PostgreSQL and dispatches actuation commands when thresholds trip.
    
- **Deliverables:**
    
    - Batch processor ingesting `agri/telemetry/#` payloads and inserting records into `sensor_telemetry`.
        
    - Command handler listening to valve trigger events, dispatching `VALVE_TRIGGER_OPEN` commands over MQTT, and transitioning `irrigation_events.status` from `PENDING` to `IN_PROGRESS` and `COMPLETED`.
        
    - Virtual soil response loop: when a valve event is active, the simulator increases parcel soil moisture progressively back toward Field Capacity.
        
- **Acceptance Criteria:**
    
    - Incoming MQTT messages persist to the database with latency $< 50\text{ ms}$.
        
    - Active watering commands visibly increase virtual soil moisture percentages on the subsequent simulator tick.
        

#### Track C: Frontend Telemetry & Dynamic Irrigation Dashboard

##### TODO-307: Time-Series Environmental & Moisture Charts

- **Assignee:** Frontend Engineer
    
- **Description:** Build responsive dual-axis line/bar charts displaying historical and projected soil moisture, evapotranspiration, rainfall, and irrigation applications.
    
- **Deliverables:**
    
    - React charting component `<ParcelTelemetryChart parcelId="{id}"/>` using Recharts or Chart.js.
        
    - Primary Y-axis: Soil Volumetric Moisture Percentage (with colored bands indicating Saturation, Field Capacity, and MAD Wilting Threshold).
        
    - Secondary Y-axis: Stacked bar series representing Precipitation ($P_{\text{eff}}$) and Irrigation Applied ($I$) in millimeters.
        
- **Acceptance Criteria:**
    
    - Charts toggle cleanly across 24-hour, 7-day, and 30-day temporal windows.
        
    - Hovering points displays precise values and status flags (e.g., "Valve Opened: 45 min").
        

##### TODO-308: Interactive Valve Override & Status Control Panel

- **Assignee:** Frontend Engineer
    
- **Description:** Implement an operator control panel allowing manual valve activation, emergency stops, and live valve status visualization.
    
- **Deliverables:**
    
    - UI widget `<IrrigationControlCard parcelId="{id}"/>`.
        
    - Manual trigger dialog allowing the operator to select watering duration (15, 30, 45, 60 minutes) calling `POST /api/v1/parcels/{id}/irrigate-manual`.
        
    - Live animated indicator displaying current valve state (`Closed`, `Opening`, `Pumping: X L/min`).
        
- **Acceptance Criteria:**
    
    - Manual actuation issues immediate feedback with optimistic UI state updates.
        
    - Active automated schedules clearly indicate time remaining until valve cutoff.
        

##### TODO-309: Water Budget & Depletion Gauge Widget

- **Assignee:** Frontend / UI Engineer
    
- **Description:** Build a visual radial gauge indicating current root-zone moisture deficit relative to the parcel's Readily Available Water (RAW) limit.
    
- **Deliverables:**
    
    - Radial gauge component `<DeficitGauge currentMoisture="{pct}" fieldCapacity="{fc}" mad="{mad}"/>`.
        
    - Color status transitions: Green (Deficit $< 50\%$ RAW), Yellow (Deficit $> 75\%$ RAW), Red (Stress Zone: Deficit $\ge \text{RAW}$).
        
    - Summary metrics readout displaying estimated hours remaining before automated irrigation trigger.
        
- **Acceptance Criteria:**
    
    - Visual gauge updates immediately when new telemetry samples stream over WebSockets or polling intervals.
        
    - Clearly highlights critical water stress boundaries based on parcel soil profile.