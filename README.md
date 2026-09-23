# Precision AgriTech Platform (`agritech`)

> A unified precision agriculture platform combining spatial field operations (GIS), dynamic automated irrigation scheduling (FAO-56 evapotranspiration modeling), and computer vision crop disease diagnostics.

---

## Architecture Overview

```
[ Field Workers / Mobile Web ]     [ Farm Admin / Desktop Dashboard ]
             \                                    /
              \                                  /
         [ Frontend: React + TypeScript + Pure Tailwind CSS v4 ]
                                 |
                                 v
                     [ Backend: ASP.NET Core (.NET 10) ]
                                 |
      +--------------------------+--------------------------+
      |                          |                          |
[ Weather APIs ]        [ Irrigation Engine ]       [ ML / Vision Service ]
- Open-Meteo            - FAO-56 Penman-Monteith    - FastAPI (Python)
- Evapotranspiration    - Water Deficit Logic       - ONNX / CNN Inference
      |                          |                          |
      +--------------------------+--------------------------+
                                 |
                                 v
                    [ Relational Database + GIS ]
                 - PostgreSQL 16 with PostGIS 3.4 (Docker)
```

---

## Repository Structure

```
agritech/
├── backend/                  # ASP.NET Core (.NET 10) Web API
│   ├── AgriTech.slnx         # Solution file
│   ├── AgriTech.Api.csproj   # API project file
│   ├── Program.cs            # Entry point & DI middleware
│   ├── Controllers/          # API Controllers
│   └── README.md             # Backend setup & documentation
│
├── frontend/                 # React + TypeScript + Vite Client
│   ├── src/                  # Application source code
│   │   ├── App.tsx           # Root UI component
│   │   └── index.css         # Pure Tailwind CSS v4 entry (@import "tailwindcss")
│   ├── vite.config.ts        # Vite config with @tailwindcss/vite plugin (no PostCSS)
│   ├── package.json          # Node dependencies & scripts
│   └── README.md             # Frontend setup & documentation
│
├── ml-service/               # Python / FastAPI Machine Learning microservice
│   ├── main.py               # Inference API entry point
│   ├── requirements.txt      # Python dependencies (FastAPI, ONNXRuntime, etc.)
│   └── README.md             # ML service setup & documentation
│
├── docker/                   # Container initialization & configurations
│   ├── postgres/             # Database initialization (PostGIS + 23 application tables)
│   │   ├── 01-init-extensions.sql
│   │   └── 02-make-tables.sql
│   └── mosquitto/config/     # Mosquitto MQTT broker configuration
│
├── PROJECT_DETAILS/          # System specifications, database design & phase plans
│   ├── PROJECT_DETAILS.md    # Comprehensive system specification & roadmap
│   ├── GIT_CHANGES.md        # Git workflow, branch naming & PR guidelines
│   ├── Database Design/      # Master database schema specifications
│   │   └── COMPLETE_DATABASE_SCHEMA.md
│   └── Phase Plans/          # Development tracks, TODOs, and engineering protocols
│       ├── Phase 1.md ... Phase 6.md
│       └── Task Completion.md
│
├── docker-compose.yml        # Local developer infrastructure (PostGIS + Mosquitto)
├── .gitignore                # Global gitignore across .NET, Node, Python & PostGIS
├── .env.example              # Environment variable template
└── README.md                 # Project root guide (this file)
```

---

## Prerequisites

Before starting, ensure you have the following installed on your machine:

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Used to run PostgreSQL 16 + PostGIS and Mosquitto with zero manual setup)
- **[.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)**
- **[Node.js](https://nodejs.org/)** (v20+ or v24 LTS)
- **[Python](https://www.python.org/)** (v3.10 to v3.14)
- **[Git](https://git-scm.com/)**

---

## Teammate Machine Setup Guide (First-Time Initialization)

Follow these steps once after cloning the repository on your computer:

### Step 1: Clone the Repository & Configure Environment

```powershell
git clone <REPOSITORY_URL>
cd agritech

# Make your local .env from the template
Copy-Item .env.example .env
```

---

### Step 2: Start the Local Infrastructure (Docker)

Make sure **Docker Desktop** is running, then execute:

```powershell
docker compose up -d
```

This automatically downloads and starts:

- **PostgreSQL 16 with PostGIS 3.4** on port `5432` (`agritech_db`, user: `postgres`, password: `postgres`).
  - _All 23 application tables, PostGIS GiST spatial indexes, and area triggers are made automatically on boot._
- **Eclipse Mosquitto MQTT Broker** on port `1883` (MQTT) and port `9001` (WebSockets).

Verify the containers are healthy:

```powershell
docker compose ps
```

> **Useful Docker Commands:**
>
> - `docker compose ps` — View container status.
> - `docker compose logs -f` — Stream live logs.
> - `docker compose down` — Stop containers safely (data is preserved in Docker volumes).

---

### Step 3: Initialize the Backend API (.NET 10)

In a new terminal:

```powershell
cd backend
dotnet restore
dotnet build
dotnet run --project AgriTech.Api.csproj
```

The API starts on `http://localhost:5000` with Swagger/OpenAPI documentation available in development.

---

### Step 4: Initialize the Frontend Client (React + Pure Tailwind CSS v4)

In a new terminal:

```powershell
cd frontend
npm install
npm run build    # Verifies TypeScript and Tailwind v4 compilation
npm run dev
```

The Vite development server will open at `http://localhost:5173`.

---

### Step 5: Initialize the ML & Vision Service (Python / FastAPI)

In a new terminal:

```powershell
cd ml-service

# 1. Make a virtual environment
python -m venv venv

# 2. Activate the virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On macOS / Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the inference service
python main.py
```

The FastAPI inference service will run at `http://localhost:8000`.

- Interactive API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

---

### Step 6: Git Workflow & Collaboration Rules

Before writing or committing code, read the team guidelines:

- **[PROJECT_DETAILS/GIT_CHANGES.md](PROJECT_DETAILS/GIT_CHANGES.md)**: Details the mandatory branch naming format (`feat/<track>-<todo-number>-<short-description>`) and how to submit Pull Requests with peer review.
- **[PROJECT_DETAILS/Phase Plans/Task Completion.md](PROJECT_DETAILS/Phase%20Plans/Task%20Completion.md)**: Defines the Definition of Done and the completion report template required for every task.

---

## Detailed Documentation & Roadmap

All technical blueprints, phase plans, and database design documents are organized inside the `PROJECT_DETAILS/` folder:

### 1. Master System Specification

- **[PROJECT_DETAILS/PROJECT_DETAILS.md](PROJECT_DETAILS/PROJECT_DETAILS.md)**: Complete capstone vision, system architecture, mathematical models (FAO-56 Penman-Monteith), ML dataset pipeline (PlantVillage), and the 3 flagship features (Disease Progression Slider, 3D Plant Anatomy Explorer, and Türkiye Regional Risk Engine).

### 2. Database Design & Schemas

- **[PROJECT_DETAILS/Database Design/COMPLETE_DATABASE_SCHEMA.md](PROJECT_DETAILS/Database%20Design/COMPLETE_DATABASE_SCHEMA.md)**: Complete master database schema specifying all 23 entities across 9 domain modules with PostGIS spatial types, `made_at` timestamp conventions, constraints, triggers, and full Mermaid ER diagram.

### 3. Git Workflow & Collaboration

- **[PROJECT_DETAILS/GIT_CHANGES.md](PROJECT_DETAILS/GIT_CHANGES.md)**: Step-by-step developer tutorial for cloning, branch naming conventions (`feat/ml-...`, `feat/api-...`, `feat/web-...`), PR peer reviews, and GitHub branch protection configuration.

### 4. Phase Plans & Team Tasks (Sprint Roadmaps)

- **[PROJECT_DETAILS/Phase Plans/Task Completion.md](PROJECT_DETAILS/Phase%20Plans/Task%20Completion.md)**: Mandatory protocol for completing tasks, running validations, and submitting completion reports.
- **[PROJECT_DETAILS/Phase Plans/Phase 1.md](PROJECT_DETAILS/Phase%20Plans/Phase%201.md)**: Phase 1 — Machine Learning Core (PlantVillage 12 classes) & Disease Progression Slider Engine (Feature #1).
- **[PROJECT_DETAILS/Phase Plans/Phase 2.md](PROJECT_DETAILS/Phase%20Plans/Phase%202.md)**: Phase 2 — Spatial Foundation, PostGIS Relational Data Layer & Leaflet Vector Boundary Editor.
- **[PROJECT_DETAILS/Phase Plans/Phase 3.md](PROJECT_DETAILS/Phase%20Plans/Phase%203.md)**: Phase 3 — Open-Meteo Ingestion, Dynamic FAO-56 Irrigation Engine & IoT Telemetry Simulator.
- **[PROJECT_DETAILS/Phase Plans/Phase 4.md](PROJECT_DETAILS/Phase%20Plans/Phase%204.md)**: Phase 4 — Interactive 3D Plant Anatomy Explorer (Feature #2, Three.js / React Three Fiber).
- **[PROJECT_DETAILS/Phase Plans/Phase 5.md](PROJECT_DETAILS/Phase%20Plans/Phase%205.md)**: Phase 5 — Türkiye Regional Crop Climate Risk Engine (Feature #3, 7 Regions / 81 Provinces).
- **[PROJECT_DETAILS/Phase Plans/Phase 6.md](PROJECT_DETAILS/Phase%20Plans/Phase%206.md)**: Phase 6 — Full Integration, Mobile PWA In-Field Inspection, DBSCAN Outbreak Clustering & Capstone Demo Triggers.
