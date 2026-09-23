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
│   ├── postgres/             # PostGIS extension scripts (auto-executed on boot)
│   └── mosquitto/config/     # Mosquitto MQTT broker configuration
│
├── PROJECT_DETAILS/          # Project documentation, plans, and database design
│   ├── PROJECT_DETAILS.md    # Comprehensive system specification & roadmap
│   ├── Database Design/      # Master database schema specifications
│   └── Phase Plans/          # Tracks and TODOs for Phases 1 through 6
│
├── docker-compose.yml        # One-command developer infrastructure (PostGIS + MQTT)
├── .gitignore                # Global gitignore across .NET, Node, Python & PostGIS
├── .env.example              # Environment variable template
└── README.md                 # Project root guide (this file)
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Used to run PostgreSQL+PostGIS and Mosquitto with zero configuration)
- **[.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)**
- **[Node.js](https://nodejs.org/)** (v20+ or v24 LTS)
- **[Python](https://www.python.org/)** (v3.10+)
- **[Git](https://git-scm.com/)**

---

## Teammate Quickstart: Running the Services

### 1. Clone the Repository
```bash
git clone <REPOSITORY_URL>
cd agritech
```

### 2. Start the Local Infrastructure (Database & MQTT Broker)
Ensure Docker Desktop is running, then run:
```powershell
docker compose up -d
```
This spins up:
- **PostgreSQL 16 + PostGIS 3.4** on port `5432` (`agritech_db`, user: `postgres`, password: `postgres`).
- **Eclipse Mosquitto MQTT Broker** on port `1883` (MQTT) and `9001` (WebSockets).

> **Useful Docker commands:**
> - `docker compose ps` — Check running containers and health status.
> - `docker compose logs -f` — View live container logs.
> - `docker compose down` — Stop the containers.

### 3. Run the Backend API (.NET 10)
In a new terminal:
```powershell
cd backend
dotnet restore
dotnet run --project AgriTech.Api.csproj
```
The API starts on `http://localhost:5000` (or the configured port).

### 4. Run the Frontend Client (React + Pure Tailwind CSS)
In a new terminal:
```powershell
cd frontend
npm install
npm run dev
```
The Vite development server will open at `http://localhost:5173`.

### 5. Run the Machine Learning Service (Python / FastAPI)
In a new terminal:
```powershell
cd ml-service
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
The FastAPI inference server will run at `http://localhost:8000`. Interactive docs are available at `http://localhost:8000/docs`.

---

## Detailed Documentation & Roadmap

For deep dives into the functional modules, data models, and feature specifications, consult:
- **[PROJECT_DETAILS/PROJECT_DETAILS.md](PROJECT_DETAILS/PROJECT_DETAILS.md)**: Full capstone blueprint including the Disease Progression Slider Engine, 3D Plant Anatomy Explorer, and Türkiye Regional Risk Engine.
- **[PROJECT_DETAILS/Database Design/COMPLETE_PROJECT_DATABASE_SCHEMA.md](PROJECT_DETAILS/Database%20Design/COMPLETE_PROJECT_DATABASE_SCHEMA.md)**: Master database schema and entity specifications across all 9 domain modules.
- **[PROJECT_DETAILS/Phase Plans/Task Completion.md](PROJECT_DETAILS/Phase%20Plans/Task%20Completion.md)**: The mandatory engineering protocol for completing TODOs, executing tests, and submitting completion reports.
