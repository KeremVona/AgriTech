# ==============================================================================
# Precision AgriTech Platform - PostGIS & EF Core Migration Verification Harness
# Task: BACK-201 / TODO-201
# ==============================================================================

$ErrorActionPreference = "Stop"

function Invoke-PgSql {
    param([string]$Sql)
    $output = $Sql | docker exec -i agritech_postgres psql -U postgres -d agritech_db -t -A
    return ($output | Out-String).Trim()
}

Write-Host "`n=======================================================" -ForegroundColor Cyan
Write-Host " AgriTech BACK-201: PostGIS & Migration Verification" -ForegroundColor Cyan
Write-Host "=======================================================`n" -ForegroundColor Cyan

# 1. Check Docker PostgreSQL container liveness
Write-Host "[1/4] Checking PostgreSQL container status..." -NoNewline
$pgReady = docker exec agritech_postgres pg_isready -U postgres -d agritech_db 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "PostgreSQL container is not accepting connections: $pgReady"
}
Write-Host " [OK]" -ForegroundColor Green

# 2. Verify EF Core Migrations History
Write-Host "[2/4] Verifying EF Core Migration table records..." -NoNewline
$migrationCheck = Invoke-PgSql 'SELECT "MigrationId" FROM "__EFMigrationsHistory" WHERE "MigrationId" LIKE ''%InitialPostGisBaseline'';'
if ($migrationCheck -match "InitialPostGisBaseline") {
    Write-Host " [OK]" -ForegroundColor Green
    Write-Host "      Found Migration: $migrationCheck" -ForegroundColor Gray
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "InitialPostGisBaseline was not found in __EFMigrationsHistory table."
}

# 3. Verify PostgreSQL Extensions: postgis & uuid-ossp
Write-Host "[3/4] Verifying installed database extensions..." -NoNewline
$extList = Invoke-PgSql "SELECT extname || ':' || extversion FROM pg_extension WHERE extname IN ('postgis', 'uuid-ossp') ORDER BY extname;"
if (($extList -match "postgis") -and ($extList -match "uuid-ossp")) {
    Write-Host " [OK]" -ForegroundColor Green
    foreach ($ext in ($extList -split "`r?`n")) {
        if ($ext.Trim().Length -gt 0) {
            Write-Host "      Extension: $ext" -ForegroundColor Gray
        }
    }
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Required extensions (postgis, uuid-ossp) missing from pg_extension."
}

# 4. Acceptance Criteria: SELECT PostGIS_Full_Version();
Write-Host "[4/4] Verifying spatial engine via PostGIS_Full_Version()..." -NoNewline
$postgisVersion = Invoke-PgSql "SELECT PostGIS_Full_Version();"
if ($postgisVersion -match "POSTGIS=") {
    Write-Host " [OK]" -ForegroundColor Green
    Write-Host "      $postgisVersion" -ForegroundColor Gray
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error "Failed to execute PostGIS_Full_Version() or PostGIS is not active."
}

# 5. Geodetic spatial function sanity check
Write-Host "`n[BONUS] Running WGS 84 ST_MakePoint & ST_AsText check..." -NoNewline
$pointCheck = Invoke-PgSql "SELECT ST_AsText(ST_SetSRID(ST_MakePoint(28.9784, 41.0082), 4326));"
if ($pointCheck -match "POINT") {
    Write-Host " [OK]" -ForegroundColor Green
    Write-Host "      Geometry Result: $pointCheck (WGS84 EPSG:4326)" -ForegroundColor Gray
} else {
    Write-Host " [WARN] Point generation test returned unexpected output." -ForegroundColor Yellow
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host " [PASS] ALL ACCEPTANCE CRITERIA SATISFIED FOR BACK-201" -ForegroundColor Green
Write-Host "=======================================================`n" -ForegroundColor Green
