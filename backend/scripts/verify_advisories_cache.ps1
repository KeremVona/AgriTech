# Verification script for PostgreSQL-cached LLM disease advisories
param(
    [string]$BaseUrl = "http://localhost:5051",
    [string]$ClassKey = "tomato/late_blight"
)

$ErrorActionPreference = "Stop"

Write-Host "1. Resolving advisory for '$ClassKey' (expects llm_generated on first call or database_cache if already cached)..." -ForegroundColor Cyan
$body = @{
    class_key = $ClassKey
    crop = "Tomato"
    condition = "Late Blight"
    scientific_name = "Phytophthora infestans"
    severity_index = "High"
} | ConvertTo-Json

$first = Invoke-RestMethod -Uri "$BaseUrl/api/v1/advisories/resolve" -Method Post -ContentType "application/json" -Body $body
Write-Host ("   First call source: {0} | model: {1}" -f $first.source, $first.llm_model)

Write-Host "2. Resolving advisory a second time (must return database_cache without calling LLM)..." -ForegroundColor Cyan
$second = Invoke-RestMethod -Uri "$BaseUrl/api/v1/advisories/resolve" -Method Post -ContentType "application/json" -Body $body
if ($second.source -ne "database_cache") {
    throw "Expected second call source to be 'database_cache', got '$($second.source)'."
}
Write-Host ("   Second call source: {0} | treatments: {1}" -f $second.source, $second.recommended_treatments.Count) -ForegroundColor Green
