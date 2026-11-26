import type { ReactNode } from 'react';
import type { FeaturePreviewKind } from './landingContent.ts';

/*
 * Stylised previews of each product area. They are illustrations (aria-hidden), not screenshots,
 * so they carry no numbers that could be read as measured results.
 */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative mt-5 h-48 overflow-hidden rounded-xl border border-ui-line bg-ui-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:h-56"
    >
      {children}
    </div>
  );
}

function Skeleton({ width }: { width: string }) {
  return <div className="h-2 rounded-full bg-ui-warm-strong" style={{ width }} />;
}

function MapPreview() {
  return (
    <Frame>
      <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <rect width="400" height="220" fill="#DCE5D0" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M${-40 + i * 34} 220 L${40 + i * 34} 0`} stroke="#CBD8BD" strokeWidth="9" />
        ))}
        <path d="M58 52 L182 38 L196 150 L72 168 Z" fill="rgba(255,255,255,0.35)" stroke="#0F766E" strokeWidth="2.5" />
        <path d="M214 46 L338 62 L326 176 L206 160 Z" fill="rgba(15,118,110,0.18)" stroke="#0F766E" strokeWidth="2.5" />
        {[
          [214, 46],
          [338, 62],
          [326, 176],
          [206, 160],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#fff" stroke="#0F766E" strokeWidth="2" />
        ))}
      </svg>
      <div className="absolute right-3 top-3 rounded-lg border border-ui-line bg-ui-bg/95 px-3 py-2 text-left shadow-sm">
        <div className="text-[11px] text-ui-ink-3">Parcel</div>
        <div className="text-xs font-medium text-ui-ink">East block</div>
      </div>
    </Frame>
  );
}

function DiagnosticsPreview() {
  return (
    <Frame>
      <div className="flex h-full">
        <div className="flex w-[45%] items-center justify-center bg-ui-warm">
          <img src="/progression-experimental/tomato/tomato_stage2_severe.webp" alt="" loading="lazy" className="h-[85%] w-auto object-contain" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-3 p-4">
          <span className="w-fit rounded-full bg-ag-risk-moderate-bg px-2.5 py-1 text-[11px] font-medium text-ag-risk-moderate">
            Disease detected
          </span>
          <div>
            <div className="mb-1.5 text-[11px] text-ui-ink-3">Model confidence</div>
            <div className="h-1.5 rounded-full bg-ui-warm-strong">
              <div className="h-full w-4/5 rounded-full bg-ui-accent" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[11px] text-ui-ink-3">Recommended treatment</div>
            <Skeleton width="90%" />
            <Skeleton width="70%" />
            <Skeleton width="80%" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

function ProgressionPreview() {
  const stages = [
    { file: 'potato_stage0_healthy', label: 'Healthy' },
    { file: 'potato_stage1_early', label: 'Early' },
    { file: 'potato_stage2_severe', label: 'Severe' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-between p-4">
        <div className="grid flex-1 grid-cols-3 gap-2">
          {stages.map((stage) => (
            <div key={stage.file} className="flex flex-col items-center justify-center rounded-lg bg-ui-warm">
              <img src={`/progression-experimental/potato/${stage.file}.webp`} alt="" loading="lazy" className="h-20 w-auto object-contain sm:h-24" />
              <span className="mt-1 text-[11px] text-ui-ink-2">{stage.label}</span>
            </div>
          ))}
        </div>
        <div className="relative mt-4 h-1.5 rounded-full bg-ui-warm-strong">
          <div className="h-full w-2/3 rounded-full bg-ui-ink" />
          <div className="absolute left-2/3 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ui-ink bg-ui-bg" />
        </div>
      </div>
    </Frame>
  );
}

function WaterPreview() {
  return (
    <Frame>
      <div className="flex h-full items-center gap-4 p-4">
        <svg viewBox="0 0 120 70" className="w-[38%] shrink-0">
          <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#EDEBE8" strokeWidth="11" strokeLinecap="round" />
          <path d="M10 62 A50 50 0 0 1 86 19" fill="none" stroke="#0891B2" strokeWidth="11" strokeLinecap="round" />
          <circle cx="60" cy="62" r="4" fill="#191918" />
          <path d="M60 62 L84 30" stroke="#191918" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="flex-1">
          <div className="mb-2 text-[11px] text-ui-ink-3">Soil moisture</div>
          <svg viewBox="0 0 200 90" className="w-full">
            <line x1="0" y1="62" x2="200" y2="62" stroke="#D97706" strokeWidth="1.5" strokeDasharray="5 4" />
            <path
              d="M0 18 C20 24 36 34 52 44 S78 60 88 58 L92 20 C110 26 126 36 140 46 S160 58 168 56"
              fill="none"
              stroke="#0891B2"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path d="M168 56 C180 52 190 50 200 48" fill="none" stroke="#0891B2" strokeWidth="2.5" strokeDasharray="4 4" />
            <rect x="86" y="70" width="8" height="20" rx="2" fill="#0F766E" opacity="0.5" />
          </svg>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-ui-ink-2">
            <span className="h-2 w-2 rounded-full bg-ag-valve-active" /> Valve ready
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function FeaturePreview({ kind }: { kind: FeaturePreviewKind }) {
  switch (kind) {
    case 'map':
      return <MapPreview />;
    case 'diagnostics':
      return <DiagnosticsPreview />;
    case 'progression':
      return <ProgressionPreview />;
    case 'water':
      return <WaterPreview />;
  }
}
