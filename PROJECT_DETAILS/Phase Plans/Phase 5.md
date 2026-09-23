## Phase 5: Türkiye Regional Crop Climate Risk Engine (Feature #3)

Phase 5 establishes the macro-agricultural risk modeling and geospatial visualization engine. It broadens the platform from micro-parcel precision management to regional and provincial scales across Türkiye. By aggregating meteorological parameters from Open-Meteo and Turkish State Meteorological Service (MGM) feeds against spatial boundaries, the engine evaluates regional vulnerability to fungal pathogens, heat/drought stress, and unseasonal frosts, projecting real-time risk scores onto an interactive choropleth map.

### Technical Specifications & Architecture

#### 1. Spatial Boundary Geometry & Administrative Hierarchy

- **Spatial Reference System:** WGS 84 (`EPSG:4326`) stored as PostGIS `GEOMETRY(MultiPolygon, 4326)`.
    
- **Administrative Granularity:**
    
    - **Macro-Agricultural Level:** Türkiye's 7 primary geographic/agricultural regions (Marmara, Ege, Akdeniz, İç Anadolu, Karadeniz, Doğu Anadolu, Güneydoğu Anadolu).
        
    - **Provincial Level:** 81 administrative provincial boundaries (`İl`) to allow localized drill-down assessments.
        
- **Optimization:** Topological simplification via Douglas-Peucker (`ST_SimplifyPreserveTopology(geom, 0.005)`) to reduce client-side vector bundle payloads below $1.8\text{ MB}$ while preserving coastal shorelines and provincial border topology.
    

#### 2. Macro Risk Scoring Mathematical Models

The climate risk engine calculates three normalized indices ($R \in [0, 100\%]$) across a rolling 14-day observation and forecast window:

##### A. Fungal Disease Risk Index ($R_{\text{fungal}}$)

Targets high-humidity foliar and fruit pathogens such as Downy Mildew (_Plasmopara viticola_), Apple Scab (_Venturia inaequalis_), and Late Blight (_Phytophthora infestans_) predominantly affecting Karadeniz and Marmara:

$$R_{\text{fungal}} = \min\left(100, \, \frac{1}{N} \sum_{d=1}^{N} \Big(f_{\text{RH}}(\overline{RH}_d) \cdot f_{T}(\overline{T}_d) \cdot \mathbb{I}(\text{rain}_d > 0.2)\Big) \times 100\right)$$

where $N = 14$ days, $\mathbb{I}$ is an indicator function for surface wetness, and:

$$f_{\text{RH}}(RH) = \begin{cases} 0, & RH < 70\% \\ \frac{RH - 70}{15}, & 70\% \le RH < 85\% \\ 1.0, & RH \ge 85\% \end{cases}$$

$$f_{T}(T) = \begin{cases} 0, & T < 12^\circ\text{C} \text{ or } T > 28^\circ\text{C} \\ 1.0 - \frac{\vert{}T - 21\vert{}}{9}, & 12^\circ\text{C} \le T \le 28^\circ\text{C} \end{cases}$$

sustained exposure within the optimal spore germination range ($18^\circ\text{C}$ to $24^\circ\text{C}$) at $RH > 80\%$ yields maximum pathogen pressure.

##### B. Drought & Heat Stress Index ($R_{\text{drought}}$)

Evaluates sustained soil water deficits and evapotranspiration strain characteristic of Güneydoğu and İç Anadolu:

$$R_{\text{drought}} = \min\left(100, \, \left( w_1 \cdot \frac{\text{CDD}}{\text{CDD}_{\max}} + w_2 \cdot \frac{\sum \max(0, \, T_{\max} - 35^\circ\text{C})}{T_{\text{excess, max}}} + w_3 \cdot \frac{ET_{0, \text{cum}} - P_{\text{cum}}}{D_{\max}} \right) \times 100\right)$$

- $\text{CDD}$: Consecutive Dry Days ($P_d < 1.0\text{ mm}$), where $\text{CDD} \ge 25\text{ days}$ represents severe risk.
    
- $T_{\max} > 35^\circ\text{C}$: Accumulated thermal heat stress.
    
- $w_1 = 0.4, w_2 = 0.35, w_3 = 0.25$: Empirically calibrated agronomic weights.
    

##### C. Frost Risk Index ($R_{\text{frost}}$)

Quantifies freezing injury risk during vernal vegetative bud break and flowering (critical for Doğu Anadolu and İç Anadolu fruit orchards):

$$R_{\text{frost}} = \begin{cases} 100, & T_{\min} \le -3.0^\circ\text{C} \\ 100 \cdot \left(\frac{2.0 - T_{\min}}{5.0}\right), & -3.0^\circ\text{C} < T_{\min} \le 2.0^\circ\text{C} \\ 0, & T_{\min} > 2.0^\circ\text{C} \end{cases}$$

scaled dynamically by seasonal vulnerability factors ($S_{\text{crop}} \in [0.2, 1.0]$) reflecting dormancy break vs. active flowering.

##### D. Composite Categorical Risk Classification

$$\text{Level} = \begin{cases} \textbf{Low (Green)}, & \max(R_{\text{fungal}}, R_{\text{drought}}, R_{\text{frost}}) < 35\% \\ \textbf{Moderate (Amber)}, & 35\% \le \max(R_{\text{fungal}}, R_{\text{drought}}, R_{\text{frost}}) < 70\% \\ \textbf{Severe (Red)}, & \max(R_{\text{fungal}}, R_{\text{drought}}, R_{\text{frost}}) \ge 70\% \end{cases}$$

#### 3. Database Schema Extensions

##### Table: `regional_boundaries`

Stores simplified spatial vector polygons for macro-regions and provinces.

|**Column**|**Type**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`VARCHAR(32)`|Primary Key|e.g., `TR-MARMARA`, `TR-34-ISTANBUL`|
|`admin_level`|`VARCHAR(16)`|Not Null|`REGION` (7 zones) or `PROVINCE` (81 il)|
|`name_tr`|`VARCHAR(80)`|Not Null|Turkish administrative name|
|`centroid_point`|`GEOMETRY(Point, 4326)`|Not Null|Central spatial coordinate for weather sampling|
|`boundary_geom`|`GEOMETRY(MultiPolygon, 4326)`|Not Null|Simplified boundary geometry|

##### Table: `regional_risk_snapshots`

Daily computed risk indices and meteorological summaries.

|**Column**|**Type**|**Constraints**|**Description**|
|---|---|---|---|
|`id`|`UUID`|Primary Key|Assessment record identifier|
|`region_id`|`VARCHAR(32)`|Foreign Key (`regional_boundaries.id`)|Target geographic zone|
|`assessment_date`|`DATE`|Not Null|Snapshot calculation date|
|`fungal_risk_score`|`NUMERIC(4, 1)`|Not Null|$R_{\text{fungal}} \in [0.0, 100.0]$|
|`drought_risk_score`|`NUMERIC(4, 1)`|Not Null|$R_{\text{drought}} \in [0.0, 100.0]$|
|`frost_risk_score`|`NUMERIC(4, 1)`|Not Null|$R_{\text{frost}} \in [0.0, 100.0]$|
|`dominant_threat`|`VARCHAR(32)`|Not Null|Primary stressor (`FUNGAL`, `DROUGHT`, `FROST`, `NONE`)|
|`vulnerable_crops`|`TEXT[]`|Not Null|Array of at-risk crops (e.g., `{"Apple", "Grape", "Wheat"}`)|
|`advisory_payload`|`JSONB`|Not Null|Agronomic advisories and weather anomaly metrics|

#### 4. RESTful Regional Risk API Contracts

```
GET /api/v1/risk/regions/geojson?level=REGION|PROVINCE
GET /api/v1/risk/regions/{id}/current
GET /api/v1/risk/regions/{id}/timeseries?days=30
```

##### Response Payload (`GET /api/v1/risk/regions/TR-KARADENIZ/current`):

JSON

```
{
  "region_id": "TR-KARADENIZ",
  "name": "Karadeniz Bölgesi",
  "assessment_date": "2026-09-21",
  "overall_risk_level": "Severe",
  "color_hex": "#EF4444",
  "indices": {
    "fungal_risk": 82.4,
    "drought_stress": 12.0,
    "frost_risk": 0.0
  },
  "climate_anomalies": {
    "relative_humidity_avg_pct": 88.2,
    "precipitation_anomaly_pct": 34.5,
    "mean_temperature_c": 19.4,
    "consecutive_wet_hours": 36
  },
  "vulnerable_crops": [
    { "crop": "Apple", "threat": "Apple Scab (Venturia inaequalis)", "vulnerability": "High" },
    { "crop": "Corn", "threat": "Northern Leaf Blight", "vulnerability": "Moderate" },
    { "crop": "Hazelnut", "threat": "Powdery Mildew", "vulnerability": "High" }
  ],
  "agronomic_advisories": [
    "Relative humidity (>85%) combined with 19°C temperatures makes optimal conditions for spore release.",
    "Recommend immediate preventative copper- or sulfur-based protective barrier sprays prior to the forecast weekend front.",
    "Suspend unnecessary overhead irrigation to reduce canopy wetness duration."
  ]
}
```

### Team Project Board TODOs

#### Track A: Geospatial Data & Climate Ingestion Pipeline

##### TODO-501: Türkiye Administrative Boundary GeoJSON Curation & Simplification

- **Assignee:** Backend / GIS Engineer
    
- **Description:** Procure, validate, and simplify boundary polygons for Türkiye's 7 geographical regions and 81 provinces.
    
- **Deliverables:**
    
    - Clean GeoJSON datasets sourced from GADM / OpenStreetMap containing proper Turkish administrative attributes (`name_tr`, `il_kodu`).
        
    - Python processing script `scripts/simplify_geojson.py` running TopoJSON/Shapely simplification to eliminate border gaps and reduce file size below $2\text{ MB}$.
        
    - Database seed script loading records into `regional_boundaries` with auto-calculated centroids (`ST_PointOnSurface(boundary_geom)`).
        
- **Acceptance Criteria:**
    
    - PostGIS spatial integrity check passes (`ST_IsValid = true` across all 81 provinces and 7 regional multi-polygons).
        
    - Boundary layers render smoothly on Leaflet without frame drops.
        

##### TODO-502: Regional Weather Aggregator Service (Open-Meteo / MGM)

- **Assignee:** Backend Engineer
    
- **Description:** Implement the data ingestion service fetching daily rolling 14-day historical and forecast climate feeds across all regional centroids.
    
- **Deliverables:**
    
    - Background worker `RegionalClimateSyncWorker` pulling daily metrics: $T_{\max}, T_{\min}, RH_{\text{avg}}$, solar radiation, precipitation, and consecutive dry days.
        
    - In-memory cache and persistent relational storage handling daily updates across all 81 provincial points.
        
    - Resilience retry handler managing API rate limits via exponential backoff.
        
- **Acceptance Criteria:**
    
    - Nightly batch sync executes for all regions/provinces in under 3 minutes.
        
    - Zero missing records; null values interpolate from adjacent regional stations.
        

#### Track B: Agronomic Risk Engine & Backend Services

##### TODO-503: Algorithmic Climate Risk Scoring Engine

- **Assignee:** Backend / Agronomy Lead
    
- **Description:** Implement mathematical logic computing $R_{\text{fungal}}$, $R_{\text{drought}}$, and $R_{\text{frost}}$ from aggregated meteorological parameters.
    
- **Deliverables:**
    
    - Service `ClimateRiskCalculator` implementing parameterized formulas for fungal spread, drought stress, and frost hazard.
        
    - Dynamic weight lookup adjusting index sensitivity based on the active crop calendar month (e.g., elevated frost sensitivity in April/May).
        
    - Unit test suite verifying index outputs against historical Turkish climate extremes (e.g., Şanlıurfa 2024 heatwave $\to R_{\text{drought}} \ge 90\%$, Rize sustained rains $\to R_{\text{fungal}} \ge 85\%$).
        
- **Acceptance Criteria:**
    
    - Indices compute deterministically to a float value within $[0.0, 100.0]$.
        
    - Test execution yields $100\%$ code coverage across boundary conditions.
        

##### TODO-504: Regional Risk Web API Controllers

- **Assignee:** Backend Engineer
    
- **Description:** Build RESTful API endpoints serving GeoJSON feature collections styled with real-time risk scores and advisory payloads.
    
- **Deliverables:**
    
    - Controller `RegionalRiskController` implementing routes:
        
        - `GET /api/v1/risk/regions/geojson` (joins spatial geometries with active risk scores).
            
        - `GET /api/v1/risk/regions/{id}/current` (delivers comprehensive diagnosis card).
            
        - `GET /api/v1/risk/regions/{id}/timeseries` (delivers 30-day historical trend).
            
    - Caching layer using Redis or memory cache with an absolute expiration of 6 hours.
        
- **Acceptance Criteria:**
    
    - GeoJSON endpoint responds with compressed payloads in $< 200\text{ ms}$.
        
    - GeoJSON properties include direct color hex codes (`#10B981`, `#F59E0B`, `#EF4444`) mapped directly to categorical levels.
        

#### Track C: Frontend Choropleth GIS Map & Regional Analytics UI

##### TODO-505: Interactive Türkiye Choropleth Map Layer

- **Assignee:** Frontend Engineer
    
- **Description:** Build the Leaflet/Mapbox choropleth layer displaying region-wide and province-wide risk polygons with dynamic color interpolation.
    
- **Deliverables:**
    
    - React component `<TurkiyeRiskMap level="REGION|PROVINCE"/>`.
        
    - Dynamic GeoJSON vector styling applying chromatic transitions: Green (Low Risk, $<35\%$), Amber (Moderate Risk, $35\text{--}70\%$), Red (Severe Risk, $>70\%$).
        
    - Toggle control allowing instant switching between 7 Macro Geographic Regions and 81 Provincial boundaries.
        
- **Acceptance Criteria:**
    
    - Hovering a polygon highlights its border and displays a tooltip summarizing the dominant threat and risk score.
        
    - Map automatically fits viewport bounds to Türkiye's national perimeter (`[35.8, 25.6]` to `[42.2, 44.8]`).
        

##### TODO-506: Regional Risk Breakdown Drawer & Advisory Cards

- **Assignee:** Frontend / UI Engineer
    
- **Description:** Construct the slide-over inspection drawer presenting crop vulnerability tables, climate anomalies, and agronomic recommendations upon clicking a region.
    
- **Deliverables:**
    
    - Slide-over UI `<RegionDetailDrawer isOpen="{...}" regionId="{selectedId}"/>`.
        
    - Radial progress gauges for Fungal, Drought, and Frost indices.
        
    - Badge list of vulnerable agricultural staples (Tomatoes, Hazelnuts, Wheat, Apples) with direct pathogen threat warnings.
        
    - Actionable advisory card outlining operational preventative protocols.
        
- **Acceptance Criteria:**
    
    - Clicking any geographic polygon opens the drawer populated with relevant data within $150\text{ ms}$.
        
    - Responsive layout collapsing cleanly to bottom-sheet view on mobile screens.