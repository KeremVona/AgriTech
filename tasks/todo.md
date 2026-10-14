# TODO-201: PostGIS Database Initialization & Migration Pipeline

## Current Status: COMPLETED
**Branch:** `feat/backend-todo201-postgis-migration-baseline`  
**Assignee:** Backend / Database Engineer  
**Phase:** Phase 2 — Spatial Foundation, GIS & Relational Data Layer  

---

- [x] **Subtask 1: Branch Initialization & Dependency Configuration**
  - Checkout branch `feat/backend-todo201-postgis-migration-baseline`.
  - Add NuGet packages: `Npgsql.EntityFrameworkCore.PostgreSQL`, `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite`, `Microsoft.EntityFrameworkCore.Design`.
  - Configure `DefaultConnection` string in `appsettings.json` and `appsettings.Development.json`.

- [x] **Subtask 2: DbContext & Extension Declarations (`AgriTechDbContext.cs`)**
  - Implement `AgriTechDbContext` configuring `HasPostgresExtension("postgis")` and `HasPostgresExtension("uuid-ossp")`.
  - Register `AgriTechDbContext` in `backend/Program.cs` with `UseNetTopologySuite()`.

- [x] **Subtask 3: EF Core Migration Generation & SQL Script Export**
  - Generate initial migration: `20261014135342_InitialPostGisBaseline`.
  - Export idempotent SQL script: `docker/postgres/01-ef-baseline-extensions.sql`.

- [x] **Subtask 4: Clean Database Instance Verification**
  - Test migration on fresh/empty PostgreSQL container instance (`docker compose down -v` -> `dotnet ef database update`).
  - Verify `__EFMigrationsHistory` table creation and migration record.

- [x] **Subtask 5: Spatial Engine Verification & Test Harness**
  - Verify PostGIS extension version: `SELECT PostGIS_Full_Version();`.
  - Verify UUID extension: `SELECT uuid_generate_v4();`.
  - Build automated test harness script: `scripts/verify_postgis_migration.ps1`.

- [x] **Subtask 6: Formal Completion Report (DoD) & Documentation**
  - Generate `PROJECT_DETAILS/Reports/Phase 2/TODO-201-postgis-baseline.md`.
  - Update `tasks/todo.md`.
