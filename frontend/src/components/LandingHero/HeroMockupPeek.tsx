interface HeroMockupPeekProps {
  onScrollToTools?: () => void;
  onSelectCrop?: (cropId: 'tomato' | 'potato' | 'corn' | 'apple') => void;
}

export function HeroMockupPeek({ onScrollToTools }: HeroMockupPeekProps) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-12 sm:mt-16 animate-hero-fade [animation-delay:500ms]">
      {/* Mockup Window Container */}
      <div className="relative rounded-t-2xl sm:rounded-t-3xl border-t border-x border-white/20 bg-slate-950/85 backdrop-blur-2xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500 hover:border-emerald-500/40 group">
        
        {/* Glow Accent Along Top Edge */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        {/* Window Title Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]/90 border border-black/20 inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/90 border border-black/20 inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f]/90 border border-black/20 inline-block" />
            <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline-block">
              agritech-console://field-zone/parcel-04a/live-telemetry
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              TELEMETRY: ONLINE
            </span>
          </div>
        </div>

        {/* Window Content Preview */}
        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Telemetry Card 1 */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-slate-400">Crop Health & Vision</span>
                <span className="text-emerald-400 font-mono text-xs">96.4% Conf</span>
              </div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span>🍅 Tomato Parcel 04</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Active early blight detection; localized necrotic margin masking armed.
              </p>
            </div>

            {/* Telemetry Card 2 */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-slate-400">FAO-56 Irrigation Engine</span>
                <span className="text-blue-400 font-mono text-xs">ET₀ 4.8 mm</span>
              </div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span>💧 Soil Moisture: 38.2%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                MAD threshold 35.0%. Valve cycle auto-scheduled for 04:30 UTC.
              </p>
            </div>

            {/* Telemetry Card 3 */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-white/5 hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-slate-400">Spatial GIS Boundary</span>
                <span className="text-amber-400 font-mono text-xs">GeoJSON</span>
              </div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span>🗺️ 2.4 Hectares</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                PostGIS containment layer active. 12 virtual probe nodes synced.
              </p>
            </div>

          </div>

          {/* Quick interactive call to scroll directly into the tool below */}
          <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-bold">●</span>
              <span>Feature #1 Morphological Progression & AI Diagnostic Scanner ready below</span>
            </div>
            <button
              type="button"
              onClick={onScrollToTools}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-medium transition-all cursor-pointer group"
            >
              <span>Explore Interactive Controls</span>
              <span className="group-hover:translate-y-0.5 transition-transform duration-200">↓</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
