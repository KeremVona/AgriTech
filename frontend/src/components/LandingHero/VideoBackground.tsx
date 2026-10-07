import { useState, useRef, useEffect } from 'react';

interface VideoBackgroundProps {
  videoSrc?: string;
}

export function VideoBackground({
  videoSrc = '/background_video.mp4',
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return true;
  });
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const isLoaded = loadedSrc === videoSrc;
  const hasError = errorSrc === videoSrc;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPlaying) {
      video.pause();
    } else if (isLoaded) {
      video.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [isPlaying, isLoaded]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0" aria-hidden="true">
      {/* Fallback & Atmospheric Botanic Gradient Base */}
      <div className="absolute inset-0 bg-[#040d09] bg-[radial-gradient(circle_at_50%_35%,#0d2f1f_0%,#06170e_60%,#020604_100%)]" />

      {/* Video Element with key and direct src for rock-solid reload support */}
      {!hasError && (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setLoadedSrc(videoSrc)}
          onCanPlay={() => setLoadedSrc(videoSrc)}
          onError={() => setErrorSrc(videoSrc)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            isLoaded ? 'opacity-85' : 'opacity-0'
          }`}
        >
          <source src={videoSrc} type="video/mp4" onError={() => setErrorSrc(videoSrc)} />
        </video>
      )}

      {/* Botanic Ambient Glow Meshes */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] mix-blend-screen pointer-events-none animate-glow-pulse" />
      <div className="absolute top-1/3 left-1/4 w-[450px] h-[450px] bg-green-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[130px] mix-blend-screen pointer-events-none" />

      {/* Codex-style Soft Vignette & Contrast Overlay */}
      {/* 1. Subtle top-to-bottom overall scrim for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/30 to-slate-950/90" />

      {/* 2. Radial vignette to emphasize center content */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,4,0.45)_65%,rgba(2,6,4,0.85)_100%)]" />

      {/* 3. Bottom gradient transition into page content */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

      {/* Interactive Video Play/Pause Control (Re-enables pointer events for this button only) */}
      <div className="absolute bottom-6 right-6 pointer-events-auto z-20 hidden sm:block">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause background video' : 'Play background video'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur-md border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all shadow-lg hover:border-emerald-500/40 cursor-pointer group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse group-hover:bg-emerald-300" />
          <span>{isPlaying ? 'Pause Ambient Video' : 'Play Ambient Video'}</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {isPlaying ? '⏸' : '▶'}
          </span>
        </button>
      </div>
    </div>
  );
}
