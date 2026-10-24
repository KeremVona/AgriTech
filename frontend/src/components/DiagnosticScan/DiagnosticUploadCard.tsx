import React, { useState, useRef } from 'react';
import type { CropId } from '../../types/progression';

interface TopProb {
  label: string;
  probability: number;
}

type Notice =
  | { kind: 'error'; title: string; message: string }
  | { kind: 'rescan'; title: string; message: string; instructions: string[]; topProbabilities: TopProb[] };

const ML_URL: string = import.meta.env.VITE_ML_URL || 'http://localhost:8000';
const ML_TIMEOUT_MS = 30000;
const SUPPORTED_CROPS = ['tomato', 'potato', 'corn', 'apple'];

/** "Grape___Black_rot" -> "Grape - Black rot" */
const prettyLabel = (label: string): string =>
  label.split('___').map((p) => p.replace(/_/g, ' ').trim()).join(' - ');

const TopList: React.FC<{ items: TopProb[] }> = ({ items }) => (
  <div className="space-y-1">
    <span className="text-xs font-semibold text-slate-300">Top predictions:</span>
    <ul className="text-xs text-slate-400 space-y-0.5">
      {items.slice(0, 3).map((t) => (
        <li key={t.label} className="flex justify-between gap-3">
          <span>{prettyLabel(t.label)}</span>
          <span className="font-mono text-emerald-400">{(t.probability * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  </div>
);

export interface DiagnosticResult {
  /** null when the crop has no progression model (not tomato/potato/corn/apple). */
  cropId: CropId | null;
  cropName: string;
  condition: string;
  scientificName: string;
  confidenceScore: number;
  severityIndex: 'Low' | 'Moderate' | 'High';
  immediateAction: string;
  recommendedSliderPct: number;
  topProbabilities?: TopProb[];
}

export interface DiagnosticUploadCardProps {
  onViewProgression: (cropId: CropId, sliderPercentage: number) => void;
  className?: string;
}

const PRESET_SAMPLES: { id: string; label: string; cropId: CropId; condition: string; confidence: number; severity: 'Low' | 'Moderate' | 'High'; sliderPct: number; action: string }[] = [
  {
    id: 'sample-tomato',
    label: '🍅 Sample Tomato Leaf',
    cropId: 'tomato',
    condition: 'Early Blight',
    confidence: 0.946,
    severity: 'Moderate',
    sliderPct: 50.0,
    action: 'Apply preventive copper hydroxide barrier before precipitation; prune affected lower foliage.',
  },
  {
    id: 'sample-potato',
    label: '🥔 Sample Potato Leaf',
    cropId: 'potato',
    condition: 'Late Blight',
    confidence: 0.968,
    severity: 'High',
    sliderPct: 85.0,
    action: 'Immediately halt overhead irrigation; apply systemic curative fungicide (cymoxanil/mancozeb).',
  },
  {
    id: 'sample-corn',
    label: '🌽 Sample Corn Leaf',
    cropId: 'corn',
    condition: 'Common Rust',
    confidence: 0.912,
    severity: 'Moderate',
    sliderPct: 45.0,
    action: 'Monitor field canopy spread; apply foliar triazole if rust threatens upper canopy before R5.',
  },
  {
    id: 'sample-apple',
    label: '🍏 Sample Apple Leaf',
    cropId: 'apple',
    condition: 'Apple Scab',
    confidence: 0.954,
    severity: 'Moderate',
    sliderPct: 55.0,
    action: 'Apply kick-back curative fungicide within 72 hours of primary infection weather event.',
  },
];

export const DiagnosticUploadCard: React.FC<DiagnosticUploadCardProps> = ({
  onViewProgression,
  className = '',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setNotice(null);
    }
  };

  const handleSelectSample = (sample: typeof PRESET_SAMPLES[0]) => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setNotice(null);
    setResult({
      cropId: sample.cropId,
      cropName: sample.cropId.charAt(0).toUpperCase() + sample.cropId.slice(1),
      condition: sample.condition,
      scientificName: sample.cropId === 'tomato' ? 'Alternaria solani' : sample.cropId === 'potato' ? 'Phytophthora infestans' : sample.cropId === 'corn' ? 'Puccinia sorghi' : 'Venturia inaequalis',
      confidenceScore: sample.confidence,
      severityIndex: sample.severity,
      immediateAction: sample.action,
      recommendedSliderPct: sample.sliderPct,
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setNotice(null);
    setResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      let res: Response;
      try {
        res = await fetch(`${ML_URL}/api/v1/classify-leaf`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } catch {
        setNotice({
          kind: 'error',
          title: 'ML service unreachable',
          message: `Could not reach the ML service at ${ML_URL} (network error or ${ML_TIMEOUT_MS / 1000}s timeout). No diagnosis was made.`,
        });
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.message || (typeof data?.detail === 'string' ? data.detail : null) || `HTTP ${res.status}`;
        setNotice({
          kind: 'error',
          title: res.status === 503 ? 'ML model unavailable' : 'ML service error',
          message: msg,
        });
        return;
      }

      const probs: TopProb[] = Array.isArray(data?.top_probabilities) ? data.top_probabilities : [];

      if (data?.requires_rescan) {
        setNotice({
          kind: 'rescan',
          title: 'Please re-scan the leaf',
          message: data.low_confidence_advisory?.message || 'Confidence too low for a reliable diagnosis.',
          instructions: data.low_confidence_advisory?.rescan_instructions || data.rescan_instructions || [],
          topProbabilities: probs,
        });
        return;
      }

      const pred = data.prediction;
      const cropLower = String(pred.crop).toLowerCase();
      const supported = (SUPPORTED_CROPS as string[]).includes(cropLower);
      const severity = (pred.severity_index || 'Moderate') as 'Low' | 'Moderate' | 'High';
      const sliderPct = severity === 'Low' ? 25.0 : severity === 'Moderate' ? 50.0 : 85.0;

      setResult({
        cropId: supported ? (cropLower as CropId) : null,
        cropName: pred.crop,
        condition: pred.condition,
        scientificName: pred.scientific_name || 'Plant Pathogen',
        confidenceScore: pred.confidence_score,
        severityIndex: severity,
        immediateAction: data.agronomic_advisory?.immediate_action || 'Inspect field foliage.',
        recommendedSliderPct: sliderPct,
        topProbabilities: probs,
      });
    } finally {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 ${className}`}>
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>🔬</span> AI Leaf Diagnostics & Progression Linkage
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload an image to classify disease symptoms and visualize projected progression trajectories.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono">Inference Engine Live</span>
        </div>
      </div>

      {/* Upload Zone & Sample Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-5 flex flex-col items-center justify-center gap-3 bg-slate-950/40 cursor-pointer transition-all hover:bg-slate-900/60"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
              <img src={previewUrl} alt="Leaf Upload" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl text-slate-300">
              📷
            </div>
          )}

          <div className="text-center space-y-1">
            <span className="text-xs font-semibold text-slate-200">
              {selectedFile ? selectedFile.name : 'Click to upload leaf photo'}
            </span>
            <p className="text-[11px] text-slate-500">Supports JPG, PNG, WebP up to 10MB</p>
          </div>

          {selectedFile && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={(e) => {
                e.stopPropagation();
                handleAnalyze();
              }}
              className="mt-1 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing Image...' : 'Run Diagnostics'}
            </button>
          )}
        </div>

        {/* Quick Sample Presets */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400 block mb-1.5">
            Or test with verified clinical specimens:
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESET_SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-slate-300 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>{sample.label}</span>
                <span className="text-[11px] font-mono text-emerald-400">{sample.condition}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="alert"
          className={`rounded-xl p-4 space-y-2 border ${
            notice.kind === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <span className="text-sm font-bold text-white block">{notice.title}</span>
          <p className="text-xs text-slate-300 leading-relaxed">{notice.message}</p>
          {notice.kind === 'rescan' && notice.instructions.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-slate-400 space-y-0.5">
              {notice.instructions.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {notice.kind === 'rescan' && notice.topProbabilities.length > 0 && <TopList items={notice.topProbabilities} />}
        </div>
      )}

      {/* Diagnostic Result & Progression Linkage CTA */}
      {result && (
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-fade-in shadow-inner">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {result.cropName}: {result.condition}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    result.severityIndex === 'High'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : result.severityIndex === 'Moderate'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  Severity: {result.severityIndex}
                </span>
              </div>
              <span className="text-xs text-slate-400 italic">{result.scientificName}</span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">Confidence</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {(result.confidenceScore * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-300">Prescribed Agronomic Action:</span>
            <p className="text-xs text-slate-400 leading-relaxed">{result.immediateAction}</p>
          </div>

          {result.topProbabilities && result.topProbabilities.length > 0 && (
            <TopList items={result.topProbabilities} />
          )}

          {/* Action Link to Disease Progression Slider */}
          {result.cropId ? (
          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => onViewProgression(result.cropId as CropId, result.recommendedSliderPct)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer transform hover:scale-[1.02]"
            >
              <span>🔬</span>
              <span>Project Progression Trajectory in Slider ({result.recommendedSliderPct.toFixed(0)}%) →</span>
            </button>
          </div>
          ) : (
            <p className="text-[11px] text-slate-500 pt-1">
              No progression model available for {result.cropName}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
