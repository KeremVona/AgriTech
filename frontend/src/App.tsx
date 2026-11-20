import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DiseaseProgressionPage } from './pages/DiseaseProgressionPage';
import { LeafDiagnosticsPage } from './pages/LeafDiagnosticsPage';

const FieldMapPage = lazy(() => import('./pages/FieldMapPage').then((module) => ({ default: module.FieldMapPage })));
const fieldMapRoute = <Suspense fallback={<div className="p-6 text-ag-ink" role="status">Loading field map…</div>}><FieldMapPage /></Suspense>;

const ParcelIrrigationPage = lazy(() => import('./pages/ParcelIrrigationPage').then((module) => ({ default: module.ParcelIrrigationPage })));
const parcelIrrigationRoute = <Suspense fallback={<div className="p-6 text-ag-ink" role="status">Loading water dashboard…</div>}><ParcelIrrigationPage /></Suspense>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/" element={<LandingPage />} />

        {/* Dedicated Disease Progression Studio (SPEC-UI-007) */}
        <Route path="/disease-progression" element={<DiseaseProgressionPage />} />

        {/* Deprecated Experimental Sandbox Route: Redirect to Canonical Production Studio */}
        <Route path="/disease-progression-experimental" element={<Navigate to="/disease-progression" replace />} />

        {/* Dedicated AI Leaf Diagnostics Workbench Routes (SPEC-UI-006) */}
        <Route path="/diagnostics" element={<LeafDiagnosticsPage />} />
        <Route path="/leaf-scanner" element={<LeafDiagnosticsPage />} />

        <Route path="/map" element={fieldMapRoute} />
        <Route path="/fields/:fieldId/parcels" element={fieldMapRoute} />
        <Route path="/field-map" element={<Navigate to="/map" replace />} />

        {/* Parcel Water Dashboard (Phase 3: TODO-307 / 308 / 309) */}
        <Route path="/parcels/:parcelId/irrigation" element={parcelIrrigationRoute} />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
