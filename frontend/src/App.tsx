import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';

const FieldMapPage = lazy(() => import('./pages/FieldMapPage').then((module) => ({ default: module.FieldMapPage })));
const DiseaseProgressionPage = lazy(() => import('./pages/DiseaseProgressionPage').then((module) => ({ default: module.DiseaseProgressionPage })));
const progressionRoute = <Suspense fallback={<div className="p-6 text-ag-ink" role="status">Loading disease progression studio…</div>}><DiseaseProgressionPage /></Suspense>;

const LeafDiagnosticsPage = lazy(() => import('./pages/LeafDiagnosticsPage').then((module) => ({ default: module.LeafDiagnosticsPage })));
const diagnosticsRoute = <Suspense fallback={<div className="p-6 text-ag-ink" role="status">Loading leaf diagnostics…</div>}><LeafDiagnosticsPage /></Suspense>;

const fieldMapRoute = <Suspense fallback={<div className="p-6 text-ag-ink" role="status">Loading field map…</div>}><FieldMapPage /></Suspense>;

const ParcelIrrigationPage = lazy(() => import('./pages/ParcelIrrigationPage').then((module) => ({ default: module.ParcelIrrigationPage })));
const parcelIrrigationRoute = <Suspense fallback={<div className="p-6 text-ag-ink" role="status">Loading water dashboard…</div>}><ParcelIrrigationPage /></Suspense>;

const BlogIndexPage = lazy(() => import('./pages/BlogIndexPage').then((module) => ({ default: module.BlogIndexPage })));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage').then((module) => ({ default: module.BlogPostPage })));
const blogFallback = <div className="p-6 text-ag-ink" role="status">Loading blog…</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/" element={<LandingPage />} />

        {/* Dedicated Disease Progression Studio (SPEC-UI-007) */}
        <Route path="/disease-progression" element={progressionRoute} />

        {/* Deprecated Experimental Sandbox Route: Redirect to Canonical Production Studio */}
        <Route path="/disease-progression-experimental" element={<Navigate to="/disease-progression" replace />} />

        {/* Dedicated AI Leaf Diagnostics Workbench Routes (SPEC-UI-006) */}
        <Route path="/diagnostics" element={diagnosticsRoute} />
        <Route path="/leaf-scanner" element={diagnosticsRoute} />

        <Route path="/map" element={fieldMapRoute} />
        <Route path="/fields/:fieldId/parcels" element={fieldMapRoute} />
        <Route path="/field-map" element={<Navigate to="/map" replace />} />

        {/* Parcel Water Dashboard (Phase 3: TODO-307 / 308 / 309) */}
        <Route path="/parcels/:parcelId/irrigation" element={parcelIrrigationRoute} />

        {/* Blog: one Markdown file per post in src/content/blog */}
        <Route path="/blog" element={<Suspense fallback={blogFallback}><BlogIndexPage /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={blogFallback}><BlogPostPage /></Suspense>} />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
