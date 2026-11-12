using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriTech.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemainingSchemaTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                -- =============================================================
                -- 15 Remaining Tables from COMPLETE_DATABASE_SCHEMA.md
                -- =============================================================

                -- Module 2: Crop Growth Stages
                CREATE TABLE IF NOT EXISTS crop_growth_stages (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
                    stage_name VARCHAR(30) NOT NULL,
                    stage_order INTEGER NOT NULL,
                    duration_days INTEGER NOT NULL,
                    kc_value NUMERIC(3, 2) NOT NULL,
                    root_depth_ratio NUMERIC(3, 2) NOT NULL
                );

                -- Module 3: Plant Pathology & Treatments
                CREATE TABLE IF NOT EXISTS diseases (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
                    common_name VARCHAR(100) NOT NULL,
                    scientific_name VARCHAR(120),
                    pathogen_type VARCHAR(30) NOT NULL,
                    risk_level VARCHAR(20) NOT NULL,
                    general_description TEXT NOT NULL,
                    favorable_conditions TEXT
                );

                CREATE TABLE IF NOT EXISTS treatments (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
                    treatment_type VARCHAR(30) NOT NULL,
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

                -- Module 4: 3D Plant Anatomy Explorer
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
                    id VARCHAR(64) PRIMARY KEY,
                    model_id UUID NOT NULL REFERENCES crop_anatomy_models(id) ON DELETE CASCADE,
                    zone_code VARCHAR(30) NOT NULL,
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

                -- Module 5: Sensor Telemetry
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

                -- Module 6: Meteorology & Irrigation Actuation
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
                    trigger_type VARCHAR(30) NOT NULL,
                    status VARCHAR(20) NOT NULL,
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

                -- Module 7: Outbreaks & Spatial Clusters
                CREATE TABLE IF NOT EXISTS disease_outbreak_clusters (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
                    disease_id UUID NOT NULL REFERENCES diseases(id) ON DELETE CASCADE,
                    cluster_polygon GEOMETRY(Polygon, 4326) NOT NULL,
                    infection_count INTEGER NOT NULL,
                    avg_confidence NUMERIC(5, 4) NOT NULL,
                    severity_level VARCHAR(20) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    first_detected_at TIMESTAMPTZ NOT NULL,
                    last_detected_at TIMESTAMPTZ NOT NULL,
                    lock_overhead_irrigation BOOLEAN NOT NULL DEFAULT TRUE
                );

                -- Module 8: Macro Regional Boundaries & Risk Snapshots
                CREATE TABLE IF NOT EXISTS regional_boundaries (
                    id VARCHAR(32) PRIMARY KEY,
                    admin_level VARCHAR(16) NOT NULL,
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
                    dominant_threat VARCHAR(32) NOT NULL,
                    overall_risk_level VARCHAR(20) NOT NULL,
                    color_hex VARCHAR(7) NOT NULL,
                    vulnerable_crops TEXT[] NOT NULL,
                    climate_anomalies JSONB NOT NULL,
                    advisory_payload JSONB NOT NULL,
                    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_regional_risk_date UNIQUE (region_id, assessment_date)
                );

                -- Module 9: Demo Scenarios
                CREATE TABLE IF NOT EXISTS demo_scenarios (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT NOT NULL,
                    target_entity_type VARCHAR(30) NOT NULL,
                    injection_parameters JSONB NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT FALSE,
                    activated_at TIMESTAMPTZ
                );

                -- GiST and B-Tree Indexes
                CREATE INDEX IF NOT EXISTS idx_outbreak_clusters_poly ON disease_outbreak_clusters USING GIST (cluster_polygon);
                CREATE INDEX IF NOT EXISTS idx_reg_boundaries_geom ON regional_boundaries USING GIST (boundary_geom);
                CREATE INDEX IF NOT EXISTS idx_reg_boundaries_centroid ON regional_boundaries USING GIST (centroid_point);
                CREATE INDEX IF NOT EXISTS idx_sensor_telemetry_parcel_time ON sensor_telemetry (parcel_id, timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_crop_growth_stages_crop_id ON crop_growth_stages (crop_id);
                CREATE INDEX IF NOT EXISTS idx_diseases_crop_id ON diseases (crop_id);
                CREATE INDEX IF NOT EXISTS idx_treatments_disease_id ON treatments (disease_id);
                CREATE INDEX IF NOT EXISTS idx_disease_progression_stages_disease_id ON disease_progression_stages (disease_id);
                CREATE INDEX IF NOT EXISTS idx_progression_visual_assets_stage_id ON progression_visual_assets (stage_id);
                CREATE INDEX IF NOT EXISTS idx_plant_anatomy_pins_model_id ON plant_anatomy_pins (model_id);
                CREATE INDEX IF NOT EXISTS idx_anatomy_pin_pathologies_pin_id ON anatomy_pin_pathologies (pin_id);
                CREATE INDEX IF NOT EXISTS idx_anatomy_pin_pathologies_disease_id ON anatomy_pin_pathologies (disease_id);
                CREATE INDEX IF NOT EXISTS idx_weather_cache_parcel_id ON weather_cache (parcel_id);
                CREATE INDEX IF NOT EXISTS idx_irrigation_events_parcel_id ON irrigation_events (parcel_id);
                CREATE INDEX IF NOT EXISTS idx_outbreak_clusters_parcel_id ON disease_outbreak_clusters (parcel_id);
                CREATE INDEX IF NOT EXISTS idx_outbreak_clusters_disease_id ON disease_outbreak_clusters (disease_id);
                CREATE INDEX IF NOT EXISTS idx_regional_risk_snapshots_region_id ON regional_risk_snapshots (region_id);

                -- Settle Schema Drifts:
                -- 1. Add model_inferences.predicted_disease_id -> diseases(id) FK constraint if missing
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_model_inferences_predicted_disease'
                    ) THEN
                        ALTER TABLE model_inferences
                        ADD CONSTRAINT fk_model_inferences_predicted_disease
                        FOREIGN KEY (predicted_disease_id) REFERENCES diseases(id) ON DELETE RESTRICT;
                    END IF;
                END $$;

                -- 2. Align users.role DEFAULT 'FARM_OWNER'
                ALTER TABLE users ALTER COLUMN role SET DEFAULT 'FARM_OWNER';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_model_inferences_predicted_disease'
                    ) THEN
                        ALTER TABLE model_inferences DROP CONSTRAINT fk_model_inferences_predicted_disease;
                    END IF;
                END $$;

                DROP INDEX IF EXISTS idx_regional_risk_snapshots_region_id;
                DROP INDEX IF EXISTS idx_outbreak_clusters_disease_id;
                DROP INDEX IF EXISTS idx_outbreak_clusters_parcel_id;
                DROP INDEX IF EXISTS idx_irrigation_events_parcel_id;
                DROP INDEX IF EXISTS idx_weather_cache_parcel_id;
                DROP INDEX IF EXISTS idx_anatomy_pin_pathologies_disease_id;
                DROP INDEX IF EXISTS idx_anatomy_pin_pathologies_pin_id;
                DROP INDEX IF EXISTS idx_plant_anatomy_pins_model_id;
                DROP INDEX IF EXISTS idx_progression_visual_assets_stage_id;
                DROP INDEX IF EXISTS idx_disease_progression_stages_disease_id;
                DROP INDEX IF EXISTS idx_treatments_disease_id;
                DROP INDEX IF EXISTS idx_diseases_crop_id;
                DROP INDEX IF EXISTS idx_crop_growth_stages_crop_id;
                DROP INDEX IF EXISTS idx_sensor_telemetry_parcel_time;
                DROP INDEX IF EXISTS idx_reg_boundaries_centroid;
                DROP INDEX IF EXISTS idx_reg_boundaries_geom;
                DROP INDEX IF EXISTS idx_outbreak_clusters_poly;

                DROP TABLE IF EXISTS demo_scenarios CASCADE;
                DROP TABLE IF EXISTS regional_risk_snapshots CASCADE;
                DROP TABLE IF EXISTS regional_boundaries CASCADE;
                DROP TABLE IF EXISTS disease_outbreak_clusters CASCADE;
                DROP TABLE IF EXISTS irrigation_events CASCADE;
                DROP TABLE IF EXISTS weather_cache CASCADE;
                DROP TABLE IF EXISTS sensor_telemetry CASCADE;
                DROP TABLE IF EXISTS anatomy_pin_pathologies CASCADE;
                DROP TABLE IF EXISTS plant_anatomy_pins CASCADE;
                DROP TABLE IF EXISTS crop_anatomy_models CASCADE;
                DROP TABLE IF EXISTS progression_visual_assets CASCADE;
                DROP TABLE IF EXISTS disease_progression_stages CASCADE;
                DROP TABLE IF EXISTS treatments CASCADE;
                DROP TABLE IF EXISTS diseases CASCADE;
                DROP TABLE IF EXISTS crop_growth_stages CASCADE;
            ");
        }
    }
}
