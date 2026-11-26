import { CropStrip } from '../components/Landing/CropStrip';
import { FeatureGrid } from '../components/Landing/FeatureGrid';
import { FlowDiagram } from '../components/Landing/FlowDiagram';
import { DIAGNOSIS_FLOW, IRRIGATION_FLOW } from '../components/Landing/landingContent';
import { ClosingCta, LandingFooter } from '../components/Landing/LandingFooter';
import { LandingHero } from '../components/Landing/LandingHero';
import { LandingNav } from '../components/Landing/LandingNav';

/** Landing page (`/`), Notion-style. Design: docs/superpowers/specs/2026-11-26-landing-notion-redesign-design.md */
export function LandingPage() {
  return (
    <div className="ui-page min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ui-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <LandingHero />
        <FeatureGrid />
        <FlowDiagram flow={DIAGNOSIS_FLOW} />
        <FlowDiagram flow={IRRIGATION_FLOW} />
        <CropStrip />
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
