import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { DiseaseProgressionPage } from './pages/DiseaseProgressionPage';
import { DiseaseProgressionExperimentalPage } from './p2p-experimental/pages/DiseaseProgressionExperimentalPage';
import { LeafDiagnosticsPage } from './pages/LeafDiagnosticsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page Route */}
        <Route path="/" element={<LandingPage />} />

        {/* Dedicated Disease Progression Page Route (Presentation) */}
        <Route path="/disease-progression" element={<DiseaseProgressionPage />} />

        {/* Experimental P2P Laboratory Route (Tier 1 Features) */}
        <Route path="/disease-progression-experimental" element={<DiseaseProgressionExperimentalPage />} />

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
