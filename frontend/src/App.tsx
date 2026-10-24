import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DiseaseProgressionPage } from './pages/DiseaseProgressionPage';
import { LeafDiagnosticsPage } from './pages/LeafDiagnosticsPage';

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

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
