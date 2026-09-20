import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl">
            🌱
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Precision AgriTech Platform</h1>
            <p className="text-sm text-slate-400">Groundwork & Initial Boilerplate</p>
          </div>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          Project foundation initialized with React, Vite, TypeScript, and pure Tailwind CSS (no PostCSS).
          The platform is ready for teammates to clone and develop field telemetry, ML disease classification,
          and GIS spatial operations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 font-medium">Backend API</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1">.NET 10 C#</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 font-medium">Frontend Client</div>
            <div className="text-sm font-semibold text-cyan-400 mt-1">React + Tailwind v4</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-400 font-medium">Vision Service</div>
            <div className="text-sm font-semibold text-purple-400 mt-1">FastAPI Python</div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700/60 pt-6">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Interactivity Test: {count}
          </button>
          <span className="text-xs text-slate-500">Pure Tailwind CSS Configured</span>
        </div>
      </div>
    </div>
  )
}

export default App
