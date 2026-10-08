import React from 'react';
import type { AgronomicFieldReportData } from '../models/exportReportModel';

export interface DiagnosticPdfReportModalProps {
  reportData: AgronomicFieldReportData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticPdfReportModal: React.FC<DiagnosticPdfReportModalProps> = ({
  reportData,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !reportData) return null;

  const handlePrint = () => {
    window.print();
  };

  const { telemetry, foliar, treatment, culturalControls, canvasSnapshotDataUrl } = reportData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Print Stylesheet overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #agronomic-printable-report, #agronomic-printable-report * {
            visibility: visible;
          }
          #agronomic-printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 24px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:border-none print:shadow-none print:bg-white">
        {/* Sticky Action Header (Screen only) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <h3 className="text-base font-bold text-white tracking-wide">
              Field Diagnostic & Advisory PDF Preview
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="overflow-y-auto p-8 print:p-0 print:overflow-visible text-slate-200 print:text-black">
          <div
            id="agronomic-printable-report"
            className="bg-slate-950 print:bg-white rounded-2xl p-6 border border-slate-800 print:border-none print:p-0 space-y-6"
          >
            {/* 1. Official Letterhead Header */}
            <div className="flex items-start justify-between border-b-2 border-emerald-500/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl print:text-emerald-700">🌱</span>
                  <h1 className="text-lg font-black tracking-wider uppercase text-white print:text-black">
                    Precision AgriTech Platform
                  </h1>
                </div>
                <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
                  Phytopathology Extension Service • Foliar Diagnostic Advisory Report
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-emerald-400 print:text-emerald-700">
                  {reportData.reportId}
                </div>
                <div className="text-[11px] text-slate-400 print:text-gray-500 mt-0.5">
                  {reportData.generatedDateFormatted}
                </div>
              </div>
            </div>

            {/* 2. Foliar Specimen & Canvas Snapshot Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              {/* Snapshot Image */}
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 print:bg-gray-50 border border-slate-800 print:border-gray-200">
                {canvasSnapshotDataUrl ? (
                  <img
                    src={canvasSnapshotDataUrl}
                    alt="Foliar Snapshot"
                    className="w-full max-h-56 object-contain rounded-lg filter drop-shadow-md"
                  />
                ) : (
                  <div className="w-full h-44 flex items-center justify-center text-xs text-slate-500">
                    No foliar image attached
                  </div>
                )}
                <span className="text-[10px] text-slate-400 print:text-gray-500 mt-1.5 font-mono">
                  Specimen Canvas Snapshot (Progression Stage {foliar.stageOrder})
                </span>
              </div>

              {/* Foliar Metrics Grid */}
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-bold text-white print:text-black">
                    {foliar.cropName} • {foliar.diseaseName}
                  </h2>
                  <p className="text-xs text-slate-400 print:text-gray-600 italic">
                    {foliar.pathogenScientific} ({foliar.pathogenType})
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-900/90 print:bg-gray-100 p-2.5 rounded-lg border border-slate-800 print:border-gray-300">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">
                      Foliar Severity:
                    </span>
                    <strong className="text-sm text-amber-400 print:text-amber-700">
                      {foliar.severityPercentage.toFixed(1)}%
                    </strong>
                  </div>

                  <div className="bg-slate-900/90 print:bg-gray-100 p-2.5 rounded-lg border border-slate-800 print:border-gray-300">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">
                      Field Timeline:
                    </span>
                    <strong className="text-sm text-emerald-400 print:text-emerald-700">
                      Day {foliar.calibratedFieldDays.toFixed(1)}
                    </strong>
                  </div>

                  <div className="bg-slate-900/90 print:bg-gray-100 p-2.5 rounded-lg border border-slate-800 print:border-gray-300">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">
                      Active Stage:
                    </span>
                    <strong className="text-xs text-slate-200 print:text-black">
                      Stage {foliar.stageOrder} ({foliar.stageLabel})
                    </strong>
                  </div>

                  <div className="bg-slate-900/90 print:bg-gray-100 p-2.5 rounded-lg border border-slate-800 print:border-gray-300">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">
                      Green Leaf Area:
                    </span>
                    <strong className="text-sm text-emerald-300 print:text-emerald-700">
                      {foliar.greenLeafAreaPct.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Microclimate Telemetry Grid */}
            <div className="bg-slate-900/70 print:bg-gray-100 p-3.5 rounded-xl border border-slate-800 print:border-gray-300">
              <span className="text-xs font-bold text-slate-300 print:text-black block mb-2">
                Field Microclimate Telemetry
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 print:text-gray-600 block">Ambient Temp:</span>
                  <strong className="text-white print:text-black">{telemetry.temperatureC.toFixed(1)}°C</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 print:text-gray-600 block">Relative Humidity:</span>
                  <strong className="text-white print:text-black">{telemetry.humidityPct.toFixed(0)}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 print:text-gray-600 block">Rate Multiplier:</span>
                  <strong className="text-amber-400 print:text-amber-700">
                    {telemetry.microclimateMultiplier.toFixed(2)}×
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 print:text-gray-600 block">Status:</span>
                  <strong className="text-xs text-slate-300 print:text-gray-800">
                    {telemetry.environmentalConditionLabel}
                  </strong>
                </div>
              </div>
            </div>

            {/* 4. Intervention & Treatment Advisory Section */}
            <div className="border border-slate-800 print:border-gray-300 rounded-xl p-4 bg-slate-900/50 print:bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 print:text-emerald-700 uppercase tracking-wide">
                  Phytosanitary Treatment Advisory
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800 print:bg-gray-200 text-slate-300 print:text-gray-800">
                  {treatment.isTreatmentSimulated ? 'Intervention Active' : 'Untreated Benchmark'}
                </span>
              </div>

              {treatment.activeProduct && (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <strong className="text-white print:text-black text-sm">
                        {treatment.activeProduct.tradeName}
                      </strong>
                      <span className="ml-2 font-mono text-[11px] font-bold text-amber-400 print:text-amber-800">
                        {treatment.activeProduct.fracCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 print:text-gray-600 font-mono">
                      PHI: {treatment.activeProduct.preHarvestIntervalDays} days • Rainfast:{' '}
                      {treatment.activeProduct.rainfastnessHours}h
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 print:text-gray-700 leading-relaxed">
                    <strong>Mode of Action:</strong> {treatment.activeProduct.modeOfAction}
                  </p>
                  <p className="text-[11px] text-slate-400 print:text-gray-600 italic">
                    <strong>Stewardship:</strong> {treatment.activeProduct.applicationNotes}
                  </p>
                </div>
              )}

              {treatment.isTreatmentSimulated && (
                <div className="pt-2 border-t border-slate-800 print:border-gray-200 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-950 print:bg-white p-2 rounded-lg border border-slate-800 print:border-gray-200">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">Yield Salvaged:</span>
                    <strong className="text-amber-400 print:text-amber-800">
                      +{treatment.yieldSalvagedPct.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="bg-slate-950 print:bg-white p-2 rounded-lg border border-slate-800 print:border-gray-200">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">Net Economic Benefit:</span>
                    <strong className="text-emerald-400 print:text-emerald-700">
                      +${treatment.netEconomicBenefitUSD.toLocaleString()}/ha
                    </strong>
                  </div>
                  <div className="bg-slate-950 print:bg-white p-2 rounded-lg border border-slate-800 print:border-gray-200">
                    <span className="text-[10px] text-slate-400 print:text-gray-600 block">Curative Knockdown:</span>
                    <strong className="text-blue-400 print:text-blue-700">
                      {treatment.curativeEfficacyPct}%
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Cultural Sanitization Guidelines */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-300 print:text-black block">
                Integrated Cultural Sanitation & Disease Management:
              </span>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 print:text-gray-700 leading-relaxed">
                {culturalControls.map((ctl, idx) => (
                  <li key={idx}>{ctl}</li>
                ))}
              </ul>
            </div>

            {/* 6. Document Footer & Disclaimer */}
            <div className="pt-4 border-t border-slate-800 print:border-gray-300 text-[10px] text-slate-500 print:text-gray-500 flex items-center justify-between">
              <span>Precision AgriTech • MobileNetV3-Large & Diffusion Progression Engine</span>
              <span>CONFIDENTIAL • FOR FIELD USE ONLY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
