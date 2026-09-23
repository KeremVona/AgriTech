-- =============================================================
-- Precision AgriTech Platform - Complete Database Schema DDL
-- Conforms to PROJECT_DETAILS/Database Design/COMPLETE_DATABASE_SCHEMA.md
-- Engine: PostgreSQL 16+ with PostGIS 3.4+
-- Coordinate Reference System: WGS 84 (EPSG:4326)
-- Timestamp standard: made_at
-- =============================================================

-- Ensure required extensions are active
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- Module 1: Identity & Farm Management (Base Users)
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(30) NOT NULL, -- FARM_OWNER, AGRONOMIST, FIELD_WORKER, ADMIN
    phone_number VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Module 2: Soil & Agronomic Master Data
-- =============================================================

CREATE TABLE IF NOT EXISTS soil_profiles (
    id VARCHAR(40) PRIMARY KEY, -- sandy_loam, clay, silt_loam, loam
    name VARCHAR(80) NOT NULL,
    field_capacity_pct NUMERIC(4, 3) NOT NULL,
    wilting_point_pct NUMERIC(4, 3) NOT NULL,
    saturation_pct NUMERIC(4, 3) NOT NULL,
    hydraulic_conductivity NUMERIC(6, 2) NOT NULL,
    mad_threshold_pct NUMERIC(3, 2) NOT NULL DEFAULT 0.50
);

CREATE TABLE IF NOT EXISTS crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    common_name VARCHAR(80) UNIQUE NOT NULL, -- Tomato, Potato, Corn, Apple
    scientific_name VARCHAR(120),
    family VARCHAR(80),
    default_root_depth_max_m NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crop_growth_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    stage_name VARCHAR(30) NOT NULL, -- INITIAL, DEVELOPMENT, MID_SEASON, LATE_SEASON
    stage_order INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    kc_value NUMERIC(3, 2) NOT NULL,
    root_depth_ratio NUMERIC(3, 2) NOT NULL
);

-- =============================================================
-- Module 1: Fields & Parcels (Spatial Boundaries)
-- =============================================================

CREATE TABLE IF NOT EXISTS fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    boundary_geom GEOMETRY(Polygon, 4326) NOT NULL,
    total_area_hectares NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    location_name VARCHAR(150),
    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE RESTRICT,
    soil_profile_id VARCHAR(40) NOT NULL REFERENCES soil_profiles(id) ON DELETE RESTRICT,
    name VARCHAR(80) NOT NULL,
    boundary_geom GEOMETRY(Polygon, 4326) NOT NULL,
    area_hectares NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    planting_date DATE NOT NULL,
    kc_current NUMERIC(3, 2) NOT NULL DEFAULT 0.40,
    irrigation_method VARCHAR(30) NOT NULL DEFAULT 'DRIP',
    system_flow_rate_lpm NUMERIC(8, 2) NOT NULL DEFAULT 100.00,
    irrigation_efficiency NUMERIC(3, 2) NOT NULL DEFAULT 0.88,
    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Module 3: Plant Pathology & Progression Slider (Feature #1)
-- =============================================================

CREATE TABLE IF NOT EXISTS diseases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    common_name VARCHAR(100) NOT NULL,
    scientific_name VARCHAR(120),
    pathogen_type VARCHAR(30) NOT NULL, -- FUNGAL, BACTERIAL, VIRAL, PHYSIOLOGICAL, HEALTHY
    risk_level VARCHAR(20) NOT NULL,    -- LOW, MEDIUM, HIGH, CRITICAL
    general_description TEXT NOT NULL,
    favorable_conditions TEXT
);

CREATE TABLE IF NOT EXISTS treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    treatment_type VARCHAR(30) NOT NULL, -- CULTURAL, BIOLOGICAL, CHEMICAL, PREVENTATIVE
    title VARCHAR(150) NOT NULL,
    action_steps TEXT NOT NULL,
    active_substances TEXT,
    is_organic_certified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS disease_progression_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    stage_order INTEGER NOT NULL,
    stage_label VARCHAR(80) NOT NULL,
    min_slider_pct NUMERIC(5, 2) NOT NULL,
    max_slider_pct NUMERIC(5, 2) NOT NULL,
    symptom_markers TEXT NOT NULL,
    agronomic_advice TEXT
);

CREATE TABLE IF NOT EXISTS progression_visual_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID NOT NULL REFERENCES disease_progression_stages(id) ON DELETE CASCADE,
    base_image_url TEXT NOT NULL,
    mask_image_url TEXT,
    color_palette_hex VARCHAR(100)
);

-- =============================================================
-- Module 4: 3D Plant Anatomy Explorer (Feature #2)
-- =============================================================

CREATE TABLE IF NOT EXISTS crop_anatomy_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL UNIQUE REFERENCES crops(id) ON DELETE CASCADE,
    model_file_url TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    triangle_count INTEGER NOT NULL,
    draco_compressed BOOLEAN NOT NULL DEFAULT TRUE,
    default_camera_settings JSONB
);

CREATE TABLE IF NOT EXISTS plant_anatomy_pins (
    id VARCHAR(64) PRIMARY KEY, -- e.g. pin-tom-stem-01
    model_id UUID NOT NULL REFERENCES crop_anatomy_models(id) ON DELETE CASCADE,
    zone_code VARCHAR(30) NOT NULL, -- FOLIAGE_UPPER, STEM_VASCULAR, ROOT_COLLAR, FRUIT_CALYX
    zone_name VARCHAR(80) NOT NULL,
    coord_x NUMERIC(7, 4) NOT NULL,
    coord_y NUMERIC(7, 4) NOT NULL,
    coord_z NUMERIC(7, 4) NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anatomy_pin_pathologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pin_id VARCHAR(64) NOT NULL REFERENCES plant_anatomy_pins(id) ON DELETE CASCADE,
    disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    internal_symptom TEXT NOT NULL,
    external_symptom TEXT NOT NULL,
    histological_description TEXT,
    microscopic_image_url TEXT
);

-- =============================================================
-- Module 5: IoT Probes, Sensor Telemetry & Simulation Engine
-- =============================================================

CREATE TABLE IF NOT EXISTS sensor_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    hardware_uid VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(80) NOT NULL,
    geom_point GEOMETRY(Point, 4326) NOT NULL,
    is_virtual BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, OFFLINE, MAINTENANCE
    battery_level_pct NUMERIC(4, 1),
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_telemetry_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sensor_telemetry (
    id BIGSERIAL PRIMARY KEY,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    soil_moisture_pct NUMERIC(5, 2) NOT NULL,
    soil_temp_c NUMERIC(4, 2) NOT NULL,
    ambient_humidity_pct NUMERIC(4, 1),
    battery_voltage NUMERIC(3, 2) NOT NULL
);

-- =============================================================
-- Module 6: Meteorology & FAO-56 Irrigation Actuation Engine
-- =============================================================

CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    is_forecast BOOLEAN NOT NULL DEFAULT FALSE,
    et0_mm NUMERIC(5, 2) NOT NULL,
    precipitation_mm NUMERIC(5, 2) NOT NULL,
    effective_precipitation_mm NUMERIC(5, 2) NOT NULL,
    temp_min_c NUMERIC(4, 1) NOT NULL,
    temp_max_c NUMERIC(4, 1) NOT NULL,
    relative_humidity_avg_pct NUMERIC(4, 1),
    solar_radiation_mj NUMERIC(6, 2),
    wind_speed_ms NUMERIC(4, 1),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_weather_parcel_date UNIQUE (parcel_id, forecast_date)
);

CREATE TABLE IF NOT EXISTS irrigation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    trigger_type VARCHAR(30) NOT NULL, -- AUTOMATED_DEFICIT, MANUAL_OVERRIDE, SCHEDULED_RECIPE
    status VARCHAR(20) NOT NULL,       -- PENDING, IN_PROGRESS, COMPLETED, ABORTED
    deficit_depth_mm NUMERIC(5, 2) NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER NOT NULL,
    water_volume_liters NUMERIC(10, 2) NOT NULL,
    flow_rate_lpm NUMERIC(8, 2) NOT NULL,
    reason VARCHAR(150),
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Module 7: In-Field Mobile Inspections, Vision Inference & Outbreaks
-- =============================================================

CREATE TABLE IF NOT EXISTS model_inferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    predicted_disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE RESTRICT,
    model_version VARCHAR(50) NOT NULL,
    confidence_score NUMERIC(5, 4) NOT NULL,
    class_probabilities JSONB NOT NULL,
    inference_time_ms INTEGER NOT NULL,
    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crop_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE SET NULL,
    inference_id UUID NOT NULL REFERENCES model_inferences(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    geom_point GEOMETRY(Point, 4326) NOT NULL,
    gps_accuracy_meters NUMERIC(5, 2),
    detection_source VARCHAR(30) NOT NULL DEFAULT 'EXIF_GPS', -- EXIF_GPS, DEVICE_NAVIGATOR, MANUAL_PIN
    field_notes TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disease_outbreak_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
    cluster_polygon GEOMETRY(Polygon, 4326) NOT NULL,
    infection_count INTEGER NOT NULL,
    avg_confidence NUMERIC(5, 4) NOT NULL,
    severity_level VARCHAR(20) NOT NULL, -- MODERATE, HIGH, CRITICAL
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, CONTAINED, RESOLVED
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_detected_at TIMESTAMPTZ NOT NULL,
    lock_overhead_irrigation BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================
-- Module 8: Macro Agro-Climate Regional Risk Engine (Feature #3)
-- =============================================================

CREATE TABLE IF NOT EXISTS regional_boundaries (
    id VARCHAR(32) PRIMARY KEY, -- e.g. TR-MARMARA, TR-16-BURSA
    admin_level VARCHAR(16) NOT NULL, -- REGION, PROVINCE
    parent_region_id VARCHAR(32) REFERENCES regional_boundaries(id) ON DELETE SET NULL,
    name_tr VARCHAR(80) NOT NULL,
    plate_code INTEGER,
    centroid_point GEOMETRY(Point, 4326) NOT NULL,
    boundary_geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS regional_risk_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id VARCHAR(32) NOT NULL REFERENCES regional_boundaries(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    fungal_risk_score NUMERIC(4, 1) NOT NULL,
    drought_risk_score NUMERIC(4, 1) NOT NULL,
    frost_risk_score NUMERIC(4, 1) NOT NULL,
    dominant_threat VARCHAR(32) NOT NULL, -- FUNGAL, DROUGHT, FROST, NONE
    overall_risk_level VARCHAR(20) NOT NULL, -- LOW, MODERATE, SEVERE
    color_hex VARCHAR(7) NOT NULL,
    vulnerable_crops TEXT[] NOT NULL,
    climate_anomalies JSONB NOT NULL,
    advisory_payload JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_regional_risk_date UNIQUE (region_id, assessment_date)
);

-- =============================================================
-- Module 9: Presentation & Evaluation Control Fixtures (Demo Triggers)
-- =============================================================

CREATE TABLE IF NOT EXISTS demo_scenarios (
    id VARCHAR(50) PRIMARY KEY, -- moisture_deficit, late_blight_outbreak, regional_heatwave
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    target_entity_type VARCHAR(30) NOT NULL, -- PARCEL, REGION, FARM
    injection_parameters JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    activated_at TIMESTAMPTZ
);

-- =============================================================
-- Spatial & Analytical Indexing
-- =============================================================

-- GiST Spatial Indexes
CREATE INDEX IF NOT EXISTS idx_fields_boundary ON fields USING GIST (boundary_geom);
CREATE INDEX IF NOT EXISTS idx_parcels_boundary ON parcels USING GIST (boundary_geom);
CREATE INDEX IF NOT EXISTS idx_sensor_nodes_point ON sensor_nodes USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_crop_scans_point ON crop_scans USING GIST (geom_point);
CREATE INDEX IF NOT EXISTS idx_outbreak_clusters_poly ON disease_outbreak_clusters USING GIST (cluster_polygon);
CREATE INDEX IF NOT EXISTS idx_reg_boundaries_geom ON regional_boundaries USING GIST (boundary_geom);
CREATE INDEX IF NOT EXISTS idx_reg_boundaries_centroid ON regional_boundaries USING GIST (centroid_point);

-- B-Tree Analytical & Time-Series Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_telemetry_parcel_time ON sensor_telemetry (parcel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_crop_scans_parcel_scanned ON crop_scans (parcel_id, scanned_at DESC);

-- =============================================================
-- Geodesic Surface Area Triggers (Hectares)
-- =============================================================

CREATE OR REPLACE FUNCTION calculate_boundary_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.area_hectares := ROUND((ST_Area(NEW.boundary_geom::geography) / 10000.0)::numeric, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_parcel_area ON parcels;
CREATE TRIGGER trg_calculate_parcel_area
BEFORE INSERT OR UPDATE OF boundary_geom ON parcels
FOR EACH ROW EXECUTE FUNCTION calculate_boundary_area();

CREATE OR REPLACE FUNCTION calculate_field_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_area_hectares := ROUND((ST_Area(NEW.boundary_geom::geography) / 10000.0)::numeric, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_field_area ON fields;
CREATE TRIGGER trg_calculate_field_area
BEFORE INSERT OR UPDATE OF boundary_geom ON fields
FOR EACH ROW EXECUTE FUNCTION calculate_field_area();
