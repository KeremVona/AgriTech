# AgriTech - Frontend Client

The frontend client for the **Precision AgriTech Platform**, built with **React**, **TypeScript**, **Vite**, and **pure Tailwind CSS v4**.

## Overview

The client application powers farm managers and field workers with interactive spatial tools:

- **Interactive GIS Map**: Spatial polygon drawing and parcel status overlays via Leaflet.
- **Disease Progression Slider**: WebGL/Canvas leaf disease progression cross-dissolve engine.
- **3D Plant Anatomy Explorer**: Three.js / React Three Fiber interactive low-poly crop models with anatomical hotspot callouts.
- **Regional Risk Engine**: Türkiye 7-region / 81-province climate risk choropleth dashboard.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v24 LTS recommended)
- `npm` (packaged with Node)

## Getting Started

### 1. Install Dependencies

```powershell
npm install
```

### 2. Start the Development Server

```powershell
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### 3. Build for Production

```powershell
npm run build
```

Build output will be placed in `dist/`.
