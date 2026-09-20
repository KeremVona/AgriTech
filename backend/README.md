# AgriTech - Backend API

The backend for the **Precision AgriTech Platform**, built with **ASP.NET Core (.NET 10)**.

## Overview

The backend will serve as the core business logic, spatial data handling, and telemetry coordinator:
- **Spatial GIS & Boundaries**: Manages farm fields and parcels using Entity Framework Core and **NetTopologySuite** for PostGIS spatial queries (e.g. `ST_Contains`).
- **Telemetry & Irrigation Engine**: Processes simulated sensor streams and computes daily water deficits using the FAO-56 Penman-Monteith equation and Open-Meteo data.
- **RESTful Endpoints**: Serves crop diagnostics, field telemetry, and weather data to the frontend client.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)

## Getting Started

### 1. Restore & Build
```powershell
dotnet build AgriTech.slnx
```

### 2. Run the Web API
```powershell
dotnet run --project AgriTech.Api.csproj
```
The API will launch with OpenAPI (Swagger) documentation enabled in development.

## Project Structure
- `AgriTech.slnx`: Solution file for Visual Studio, Rider, or VS Code.
- `AgriTech.Api.csproj`: Web API project file targeting `net10.0`.
- `Program.cs`: Application startup, dependency injection, middleware pipeline, and local CORS setup.
- `Controllers/`: API controllers (e.g., `WeatherForecastController.cs`).
- `appsettings.json`: Configuration settings.
