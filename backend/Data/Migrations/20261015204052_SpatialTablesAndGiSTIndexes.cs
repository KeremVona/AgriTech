using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriTech.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SpatialTablesAndGiSTIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Core Reference Tables: users, crops, soil_profiles, model_inferences
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    full_name VARCHAR(120) NOT NULL,
                    role VARCHAR(30) NOT NULL DEFAULT 'FARM_OWNER',
                    phone_number VARCHAR(30),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS crops (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    common_name VARCHAR(80) UNIQUE NOT NULL,
                    scientific_name VARCHAR(120),
                    family VARCHAR(80),
                    default_root_depth_max_m NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
                    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS soil_profiles (
                    id VARCHAR(40) PRIMARY KEY,
                    name VARCHAR(80) NOT NULL,
                    field_capacity_pct NUMERIC(4, 3) NOT NULL,
                    wilting_point_pct NUMERIC(4, 3) NOT NULL,
                    saturation_pct NUMERIC(4, 3) NOT NULL,
                    hydraulic_conductivity NUMERIC(6, 2) NOT NULL,
                    mad_threshold_pct NUMERIC(3, 2) NOT NULL DEFAULT 0.50
                );

                CREATE TABLE IF NOT EXISTS model_inferences (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    predicted_disease_id UUID NOT NULL,
                    model_version VARCHAR(50) NOT NULL,
                    confidence_score NUMERIC(5, 4) NOT NULL,
                    class_probabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
                    inference_time_ms INTEGER NOT NULL,
                    made_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            ");

            // 2. Spatial Tables: fields, parcels, sensor_nodes, crop_scans
            migrationBuilder.Sql(@"
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

                CREATE TABLE IF NOT EXISTS sensor_nodes (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
                    hardware_uid VARCHAR(64) UNIQUE NOT NULL,
                    name VARCHAR(80) NOT NULL,
                    geom_point GEOMETRY(Point, 4326) NOT NULL,
                    is_virtual BOOLEAN NOT NULL DEFAULT TRUE,
                    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    battery_level_pct NUMERIC(4, 1),
                    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_telemetry_at TIMESTAMPTZ
                );

                CREATE TABLE IF NOT EXISTS crop_scans (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    parcel_id UUID REFERENCES parcels(id) ON DELETE SET NULL,
                    inference_id UUID NOT NULL REFERENCES model_inferences(id) ON DELETE CASCADE,
                    uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    image_url TEXT NOT NULL,
                    geom_point GEOMETRY(Point, 4326) NOT NULL,
                    gps_accuracy_meters NUMERIC(5, 2),
                    detection_source VARCHAR(30) NOT NULL DEFAULT 'EXIF_GPS',
                    field_notes TEXT,
                    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            ");

            // 3. Explicit GiST Spatial Indexes
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS idx_fields_boundary ON fields USING GIST (boundary_geom);
                CREATE INDEX IF NOT EXISTS idx_parcels_boundary ON parcels USING GIST (boundary_geom);
                CREATE INDEX IF NOT EXISTS idx_sensor_nodes_point ON sensor_nodes USING GIST (geom_point);
                CREATE INDEX IF NOT EXISTS idx_crop_scans_point ON crop_scans USING GIST (geom_point);

                -- Supporting Foreign Key & Lookup Indexes
                CREATE INDEX IF NOT EXISTS idx_fields_owner_id ON fields (owner_id);
                CREATE INDEX IF NOT EXISTS idx_parcels_field_id ON parcels (field_id);
                CREATE INDEX IF NOT EXISTS idx_parcels_crop_id ON parcels (crop_id);
                CREATE INDEX IF NOT EXISTS idx_parcels_soil_profile_id ON parcels (soil_profile_id);
                CREATE INDEX IF NOT EXISTS idx_sensor_nodes_parcel_id ON sensor_nodes (parcel_id);
                CREATE INDEX IF NOT EXISTS idx_crop_scans_parcel_id ON crop_scans (parcel_id);
            ");

            // 4. PL/pgSQL Geodesic Surface Area Calculation Functions and Triggers
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION calculate_boundary_area()
                RETURNS TRIGGER AS $$
                BEGIN
                    -- ST_Area on geography computes exact geodesic square meters on WGS 84 ellipsoid
                    -- Dividing by 10,000 converts m² to hectares
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
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TRIGGER IF EXISTS trg_calculate_parcel_area ON parcels;
                DROP TRIGGER IF EXISTS trg_calculate_field_area ON fields;
                DROP FUNCTION IF EXISTS calculate_boundary_area();
                DROP FUNCTION IF EXISTS calculate_field_area();

                DROP INDEX IF EXISTS idx_crop_scans_point;
                DROP INDEX IF EXISTS idx_sensor_nodes_point;
                DROP INDEX IF EXISTS idx_parcels_boundary;
                DROP INDEX IF EXISTS idx_fields_boundary;

                DROP TABLE IF EXISTS crop_scans CASCADE;
                DROP TABLE IF EXISTS sensor_nodes CASCADE;
                DROP TABLE IF EXISTS parcels CASCADE;
                DROP TABLE IF EXISTS fields CASCADE;
                DROP TABLE IF EXISTS model_inferences CASCADE;
                DROP TABLE IF EXISTS soil_profiles CASCADE;
                DROP TABLE IF EXISTS crops CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
            ");
        }
    }
}
