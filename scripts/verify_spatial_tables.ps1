# ==============================================================================
# Precision AgriTech Platform - Spatial Tables & GiST Index Verification Harness
# Task: BACK-202 / TODO-202
# ==============================================================================

$ErrorActionPreference = "Stop"

function Invoke-PgSql {
    param([string]$Sql)
    $output = $Sql | docker exec -i agritech_postgres psql -U postgres -d agritech_db -t -A
    return ($output | Out-String).Trim()
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host " AgriTech BACK-202: Spatial Tables & GiST Verification" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

# 1. Verify Tables Exist
Write-Host "[1/5] Verifying required spatial & relational tables exist..." -NoNewline
$expectedTables = @("fields", "parcels", "sensor_nodes", "crop_scans", "users")
$tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('fields', 'parcels', 'sensor_nodes', 'crop_scans', 'users');"
$foundTables = Invoke-PgSql $tableQuery
$missing = @()
foreach ($tbl in $expectedTables) {
    if ($foundTables -notmatch "\b$tbl\b") {
        $missing += $tbl
    }
}
if ($missing.Count -eq 0) {
    Write-Host " [OK]" -ForegroundColor Green
    Write-Host "      Found tables: fields, parcels, sensor_nodes, crop_scans, users" -ForegroundColor Gray
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Missing required tables: $($missing -join ', ')"
}

# 2. Verify Geometric Column Types
Write-Host "[2/5] Verifying geometric columns in PostGIS catalog..." -NoNewline
$geomQuery = "SELECT f_table_name || '.' || f_geometry_column || ':' || type || ':' || srid FROM geometry_columns WHERE f_table_name IN ('fields', 'parcels', 'sensor_nodes', 'crop_scans') ORDER BY f_table_name;"
$geomColumns = Invoke-PgSql $geomQuery

$expectedGeoms = @(
    "fields.boundary_geom:POLYGON:4326",
    "parcels.boundary_geom:POLYGON:4326",
    "sensor_nodes.geom_point:POINT:4326",
    "crop_scans.geom_point:POINT:4326"
)

$geomValid = $true
foreach ($expected in $expectedGeoms) {
    if ($geomColumns -notmatch [regex]::Escape($expected)) {
        $geomValid = $false
        Write-Host "`n      Missing geometric column definition: $expected" -ForegroundColor Red
    }
}

if ($geomValid) {
    Write-Host " [OK]" -ForegroundColor Green
    foreach ($line in ($geomColumns -split "`r?`n")) {
        if ($line.Trim().Length -gt 0) {
            Write-Host "      Geometry Column: $line" -ForegroundColor Gray
        }
    }
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Geometric column validation failed."
}

# 3. Verify Explicit GiST Spatial Indexes
Write-Host "[3/5] Verifying GiST spatial indexes..." -NoNewline
$gistQuery = "SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%USING gist%' AND indexname IN ('idx_fields_boundary', 'idx_parcels_boundary', 'idx_sensor_nodes_point', 'idx_crop_scans_point') ORDER BY indexname;"
$gistIndexes = Invoke-PgSql $gistQuery
$expectedIndexes = @("idx_fields_boundary", "idx_parcels_boundary", "idx_sensor_nodes_point", "idx_crop_scans_point")
$missingIdx = @()
foreach ($idx in $expectedIndexes) {
    if ($gistIndexes -notmatch "\b$idx\b") {
        $missingIdx += $idx
    }
}

if ($missingIdx.Count -eq 0) {
    Write-Host " [OK]" -ForegroundColor Green
    foreach ($idx in ($gistIndexes -split "`r?`n")) {
        if ($idx.Trim().Length -gt 0) {
            Write-Host "      GiST Index: $idx" -ForegroundColor Gray
        }
    }
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Missing required GiST spatial indexes: $($missingIdx -join ', ')"
}

# 4. Acceptance Criteria: PL/pgSQL Area Calculation Trigger (1.00 ha accuracy)
Write-Host "[4/5] Testing automated area calculation trigger (Acceptance Criteria)..." -NoNewline
$areaTestSql = @"
BEGIN;
INSERT INTO users (id, email, full_name, role) VALUES ('a0000000-0000-0000-0000-000000000001', 'test_area@agritech.local', 'Area Test User', 'FARM_OWNER') ON CONFLICT (id) DO NOTHING;
INSERT INTO crops (id, common_name) VALUES ('b0000000-0000-0000-0000-000000000001', 'Test Crop Area') ON CONFLICT (common_name) DO NOTHING;
INSERT INTO soil_profiles (id, name, field_capacity_pct, wilting_point_pct, saturation_pct, hydraulic_conductivity) VALUES ('test_area_soil', 'Loam', 0.28, 0.14, 0.45, 25.0) ON CONFLICT (id) DO NOTHING;

INSERT INTO fields (id, owner_id, name, boundary_geom, total_area_hectares)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Test Area Field',
    ST_SetSRID(ST_GeomFromText('POLYGON((29.0000 40.2000, 29.001176 40.2000, 29.001176 40.200901, 29.0000 40.200901, 29.0000 40.2000))'), 4326),
    0.00
) ON CONFLICT (id) DO UPDATE SET total_area_hectares = 0.00, boundary_geom = EXCLUDED.boundary_geom;

INSERT INTO parcels (id, field_id, crop_id, soil_profile_id, name, boundary_geom, area_hectares, planting_date)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    (SELECT id FROM crops WHERE common_name = 'Test Crop Area'),
    'test_area_soil',
    'Test Area Parcel',
    ST_SetSRID(ST_GeomFromText('POLYGON((29.0000 40.2000, 29.001176 40.2000, 29.001176 40.200901, 29.0000 40.200901, 29.0000 40.2000))'), 4326),
    0.00,
    CURRENT_DATE
) ON CONFLICT (id) DO UPDATE SET area_hectares = 0.00, boundary_geom = EXCLUDED.boundary_geom;

SELECT area_hectares || ':' || ROUND((ST_Area(boundary_geom::geography) / 10000.0)::numeric, 2) FROM parcels WHERE id = '10000000-0000-0000-0000-000000000001';
ROLLBACK;
"@

$areaResult = Invoke-PgSql $areaTestSql
$matchedAreaLine = ($areaResult -split "`r?`n") | Where-Object { $_ -match '^\d+\.\d+:\d+\.\d+$' } | Select-Object -Last 1

if ($matchedAreaLine) {
    $areaParts = $matchedAreaLine -split ":"
    $computedArea = [decimal]$areaParts[0]
    $exactArea = [decimal]$areaParts[1]
    $diff = [Math]::Abs($computedArea - $exactArea)
    if ($diff -le 0.01 -and $computedArea -gt 0) {
        Write-Host " [OK]" -ForegroundColor Green
        Write-Host "      Computed Area: $computedArea ha (Exact Geodesic: $exactArea ha, Diff: $diff ha)" -ForegroundColor Gray
    } else {
        Write-Host " [FAILED]" -ForegroundColor Red
        Write-Error "Trigger area calculation discrepancy: computed $computedArea ha, expected $exactArea ha"
    }
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Failed to retrieve trigger area calculation result: $areaResult"
}

# 5. Acceptance Criteria: Foreign Key Cascade Deletions (CASCADE & SET NULL)
Write-Host "[5/5] Testing Foreign Key cascade behaviors (Acceptance Criteria)..." -NoNewline
$cascadeTestSql = @"
BEGIN;
INSERT INTO users (id, email, full_name, role) VALUES ('a0000000-0000-0000-0000-000000000001', 'test_casc@agritech.local', 'Cascade Test User', 'FARM_OWNER') ON CONFLICT (id) DO NOTHING;
INSERT INTO crops (id, common_name) VALUES ('b0000000-0000-0000-0000-000000000001', 'Test Crop Casc') ON CONFLICT (common_name) DO NOTHING;
INSERT INTO diseases (id, crop_id, common_name, pathogen_type, risk_level, general_description) VALUES ('ba000000-0000-0000-0000-000000000001', (SELECT id FROM crops WHERE common_name = 'Test Crop Casc'), 'Test Blight', 'FUNGAL', 'HIGH', 'Desc') ON CONFLICT (id) DO NOTHING;
INSERT INTO soil_profiles (id, name, field_capacity_pct, wilting_point_pct, saturation_pct, hydraulic_conductivity) VALUES ('test_casc_soil', 'Loam', 0.28, 0.14, 0.45, 25.0) ON CONFLICT (id) DO NOTHING;
INSERT INTO model_inferences (id, predicted_disease_id, model_version, confidence_score, class_probabilities, inference_time_ms) VALUES ('c0000000-0000-0000-0000-000000000001', 'ba000000-0000-0000-0000-000000000001', 'v1.0', 0.9500, '{}', 45) ON CONFLICT (id) DO NOTHING;

INSERT INTO fields (id, owner_id, name, boundary_geom) VALUES ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Cascade Field', ST_SetSRID(ST_GeomFromText('POLYGON((29.0 40.0, 29.01 40.0, 29.01 40.01, 29.0 40.01, 29.0 40.0))'), 4326));
INSERT INTO parcels (id, field_id, crop_id, soil_profile_id, name, boundary_geom, planting_date) VALUES ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', (SELECT id FROM crops WHERE common_name = 'Test Crop Casc'), 'test_casc_soil', 'Cascade Parcel', ST_SetSRID(ST_GeomFromText('POLYGON((29.0 40.0, 29.01 40.0, 29.01 40.01, 29.0 40.01, 29.0 40.0))'), 4326), CURRENT_DATE);
INSERT INTO sensor_nodes (id, parcel_id, hardware_uid, name, geom_point) VALUES ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SN-CASC-001', 'Node', ST_SetSRID(ST_MakePoint(29.005, 40.005), 4326));
INSERT INTO crop_scans (id, parcel_id, inference_id, image_url, geom_point) VALUES ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'http://img.jpg', ST_SetSRID(ST_MakePoint(29.005, 40.005), 4326));

-- Delete parcel: sensor_node should cascade delete, crop_scan should set parcel_id to NULL
DELETE FROM parcels WHERE id = '10000000-0000-0000-0000-000000000001';

SELECT 
    (SELECT count(*) FROM sensor_nodes WHERE id = 'd0000000-0000-0000-0000-000000000001') || ':' ||
    (SELECT CASE WHEN parcel_id IS NULL THEN 'NULL_OK' ELSE 'NOT_NULL' END FROM crop_scans WHERE id = 'e0000000-0000-0000-0000-000000000001');

-- Delete field: remaining records should cascade
DELETE FROM fields WHERE id = 'f0000000-0000-0000-0000-000000000001';

ROLLBACK;
"@

$cascadeResult = Invoke-PgSql $cascadeTestSql
$matchedCascadeLine = ($cascadeResult -split "`r?`n") | Where-Object { $_ -match '^\d+:(NULL_OK|NOT_NULL)$' } | Select-Object -Last 1

if ($matchedCascadeLine) {
    $cascadeParts = $matchedCascadeLine -split ":"
    if ($cascadeParts[0] -eq "0" -and $cascadeParts[1] -eq "NULL_OK") {
        Write-Host " [OK]" -ForegroundColor Green
        Write-Host "      SensorNode Deleted: CASCADE OK (remaining: $($cascadeParts[0]))" -ForegroundColor Gray
        Write-Host "      CropScan Retained: SET NULL OK (status: $($cascadeParts[1]))" -ForegroundColor Gray
    } else {
        Write-Host " [FAILED]" -ForegroundColor Red
        Write-Error "Cascade verification failed: $matchedCascadeLine"
    }
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Failed to retrieve cascade test result: $cascadeResult"
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host " [PASS] ALL ACCEPTANCE CRITERIA SATISFIED FOR BACK-202" -ForegroundColor Green
Write-Host "=======================================================`n" -ForegroundColor Green
