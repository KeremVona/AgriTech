interface FeaturePillarsProps {
  onSelectFeature?: (feature: 'scanner' | 'slider') => void;
}

export function FeaturePillars({ onSelectFeature }: FeaturePillarsProps) {
  const pillars = [
    {
      title: 'Vision-Based Foliage Health',
      subtitle: 'Feature #1 & ONNX Inference',
      description:
        'Sub-100ms edge classification across 12 crop-disease classes, paired with continuous 60 FPS WebGL morphological progression modeling.',
      icon: (
        <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      badge: 'ML & WebGL',
      actionText: 'Launch Progression Slider',
      action: () => onSelectFeature?.('slider'),
    },
    {
      title: 'Dynamic FAO-56 Irrigation',
      subtitle: 'Evapotranspiration & MAD Balancing',
      description:
        'Calculates real-time crop water demand ET_c = K_c × ET_0 utilizing Open-Meteo solar radiation telemetry and automated IoT valve actuation.',
      icon: (
        <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ),
      badge: 'Phase 3 Core',
      actionText: 'Explore Telemetry Schema',
    },
    {
      title: 'Spatial GIS & Parcel Boundary',
      subtitle: 'PostGIS & Polygon Management',
      description:
        'Unified farm boundary editor with GeoJSON polygon drawing, centroid weather ingestion, and ST_Contains spatial containment indexing.',
      icon: (
        <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      ),
      badge: 'Phase 2 GIS',
      actionText: 'Inspect Spatial Architecture',
    },
  ];

  return (
    <section id="features" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-xs font-mono text-emerald-400 mb-4">
          <span>PLATFORM CAPABILITIES</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          One unified ecosystem for precision farm operations
        </h2>
        <p className="mt-3 text-base text-slate-400">
          From leaf-level cellular pathology to macro satellite parcels and daily irrigation cycles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map((pillar) => (
          <div
            key={pillar.title}
            className="rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 sm:p-7 flex flex-col justify-between hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-300 group shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  {pillar.icon}
                </div>
                <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                  {pillar.badge}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                {pillar.title}
              </h3>
              <p className="text-xs font-mono text-emerald-400/90 mt-1">
                {pillar.subtitle}
              </p>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                {pillar.description}
              </p>
            </div>

            {pillar.action && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={pillar.action}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer group-hover:translate-x-1 transition-all"
                >
                  <span>{pillar.actionText}</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
