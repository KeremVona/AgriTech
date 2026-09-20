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
                 - PostgreSQL with PostGIS extension
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
├── PROJECT_DETAILS.md        # Comprehensive system specification & roadmap
├── PHASE1_DB_SCHEMA.md       # Phase 1 database schema & entity specifications
├── .gitignore                # Global gitignore across .NET, Node, Python & PostGIS
├── .env.example              # Environment variable template
└── README.md                 # Project root guide (this file)
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **[.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)**
- **[Node.js](https://nodejs.org/)** (v20+ or v24 LTS)
- **[Python](https://www.python.org/)** (v3.10+)
- **[Git](https://git-scm.com/)**
- **[PostgreSQL](https://www.postgresql.org/)** with the **[PostGIS](https://postgis.net/)** extension

---

## Teammate Quickstart: Running the Services

### 1. Clone the Repository
```bash
git clone <REPOSITORY_URL>
cd agritech
```

### 2. Run the Backend API (.NET 10)
```powershell
cd backend
dotnet restore
dotnet run --project AgriTech.Api.csproj
```
The API starts on `http://localhost:5000` (or the configured port).

### 3. Run the Frontend Client (React + Pure Tailwind CSS)
In a new terminal:
```powershell
cd frontend
npm install
npm run dev
```
The Vite development server will open at `http://localhost:5173`.

### 4. Run the Machine Learning Service (Python / FastAPI)
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
- **[PROJECT_DETAILS.md](PROJECT_DETAILS.md)**: Full capstone blueprint including the Disease Progression Slider Engine, 3D Plant Anatomy Explorer, and Türkiye Regional Risk Engine.
- **[PHASE1_DB_SCHEMA.md](PHASE1_DB_SCHEMA.md)**: Relational schema and entity specifications for Phase 1 crop disease taxonomies, stages, and inference logging.
