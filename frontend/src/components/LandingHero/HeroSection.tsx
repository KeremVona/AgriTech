import { VideoBackground } from "./VideoBackground";
import { PartnerLogos } from "./PartnerLogos";
import { HeroMockupPeek } from "./HeroMockupPeek";

interface HeroSectionProps {
  onExploreClick?: () => void;
  onScannerClick?: () => void;
  onSliderClick?: () => void;
}

export function HeroSection({
  onExploreClick,
  onScannerClick,
  onSliderClick,
}: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative min-h-[95vh] flex flex-col justify-between pt-16 sm:pt-24 pb-0 overflow-hidden"
    >
      {/* Background Video Layer */}
      <VideoBackground videoSrc="/1.mp4" />

      {/* Main Hero Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Central App Badge / Squircle Tile (Codex style) */}
        <div className="animate-hero-fade [animation-delay:100ms] mb-8 sm:mb-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-white/95 backdrop-blur-xl shadow-[0_15px_35px_-5px_rgba(0,0,0,0.5)] border border-white/50 flex items-center justify-center p-3.5 sm:p-4 text-emerald-900 animate-float transition-transform hover:scale-105 duration-300">
            {/* Botanic Agro-Tech Flower / Glyph */}
            <svg
              className="w-full h-full text-emerald-800"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Central stem & leaf nodes */}
              <path d="M12 22V8" />
              <path d="M12 8C12 3.5 16 2 20 2c0 4-1.5 8-8 8Z" />
              <path d="M12 13C12 9.5 8 8 4 8c0 4 1.5 7 8 7Z" />
              <path d="M12 18c3-1 6-1 8-5" />
            </svg>
          </div>
        </div>

        {/* Hero Title (MASSIVE typography) */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight text-white leading-[1.08] max-w-4xl animate-hero-fade [animation-delay:200ms]">
          Cultivate your crops with AgriTech
        </h1>

        {/* Subtitle */}
        <p className="mt-5 sm:mt-7 text-base sm:text-lg md:text-xl text-slate-200/90 max-w-2xl font-normal leading-relaxed animate-hero-fade [animation-delay:300ms]">
          Move faster from symptom detection to harvest yield. Real-time foliar
          pathology vision, automated FAO-56 irrigation telemetry, and unified
          spatial parcel intelligence.
        </p>

        {/* CTA Buttons (Codex Pill Style) */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto animate-hero-fade [animation-delay:350ms]">
          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onExploreClick || onSliderClick}
            className="w-full sm:w-auto px-7 py-3 rounded-full text-sm sm:text-base font-semibold text-white bg-slate-950/90 hover:bg-slate-900 border border-white/20 hover:border-emerald-500/50 shadow-xl hover:shadow-emerald-500/10 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span>Explore Live Platform</span>
            <span className="text-emerald-400 group-hover:translate-x-1 transition-transform duration-200">
              →
            </span>
          </button>

          {/* Secondary Action Button */}
          <button
            type="button"
            onClick={onScannerClick}
            className="w-full sm:w-auto px-7 py-3 rounded-full text-sm sm:text-base font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/40 shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>AI Foliage Scanner</span>
          </button>
        </div>

        {/* Social Proof / Partner Logos */}
        <PartnerLogos />
      </div>

      {/* Codex-Style Application Mockup Window Peeking from the Bottom */}
      <div className="relative z-10 w-full mt-6">
        <HeroMockupPeek onScrollToTools={onExploreClick || onSliderClick} />
      </div>
    </section>
  );
}
