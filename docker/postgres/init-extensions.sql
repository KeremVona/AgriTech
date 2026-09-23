-- Precision AgriTech Platform - Database Initialization Script
-- Automatically executed on first container boot

-- 1. Enable PostGIS spatial extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Enable UUID generation functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Verify spatial installation
DO $$
BEGIN
    RAISE NOTICE 'PostGIS Version: %', PostGIS_Full_Version();
END $$;
