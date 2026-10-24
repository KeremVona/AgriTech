/**
 * DiagnosticPdfReportModal (SPEC-UI-007, Section 4.9).
 * Printable agronomic field advisory report modal formatted for high-contrast
 * clinical review and automated PDF printing.
 */

import React, { useEffect, useCallback } from 'react';
import type { AgronomicFieldReportData } from '../../models/exportReportModel.ts';

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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !reportData) return null;

  const handlePrint = () => {
    window.print();
  };

  const { telemetry, foliar, treatment, culturalControls, canvasSnapshotDataUrl } = reportData;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static animate-in fade-in duration-150"
    >
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
      <div className="relative w-full max-w-3xl my-8 bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:border-none print:shadow-none print:bg-white">
        {/* Sticky Action Header (Screen only) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <h3 id="pdf-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
              Field Diagnostic & Advisory PDF Preview
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all duration-150 active:scale-95 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="overflow-y-auto p-6 sm:p-8 print:p-0 print:overflow-visible text-slate-800 print:text-black">
          <div
            id="agronomic-printable-report"
            className="bg-white print:bg-white rounded-2xl p-6 border border-slate-200 print:border-none print:p-0 space-y-6 shadow-2xs"
          >
            {/* 1. Official Letterhead Header */}
            <div className="flex items-start justify-between border-b-2 border-teal-700 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌱</span>
                  <h1 className="text-lg font-black tracking-wider uppercase text-slate-900 print:text-black">
                    Precision AgriTech Platform
                  </h1>
                </div>
                <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
                  Phytopathology Extension Service • Foliar Diagnostic Advisory Report
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="font-bold text-teal-700">
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
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 print:bg-gray-50 border border-slate-200 print:border-gray-200">
                {canvasSnapshotDataUrl ? (
                  <img
                    src={canvasSnapshotDataUrl}
                    alt="Foliar Snapshot"
                    className="w-full max-h-56 object-contain rounded-lg filter drop-shadow-xs"
                  />
                ) : (
                  <div className="w-full h-44 flex items-center justify-center text-xs text-slate-400">
                    No foliar image attached
                  </div>
                )}
                <span className="text-[10px] text-slate-500 print:text-gray-500 mt-1.5 font-mono">
                  Specimen Canvas Snapshot (Progression Stage {foliar.stageOrder})
                </span>
              </div>

              {/* Foliar Metrics Grid */}
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 print:text-black">
                    {foliar.cropName} • {foliar.diseaseName}
                  </h2>
                  <p className="text-xs text-slate-500 print:text-gray-600 italic">
                    {foliar.pathogenScientific} ({foliar.pathogenType})
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 print:bg-gray-100 p-2.5 rounded-lg border border-slate-200 print:border-gray-300">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">
                      Foliar Severity:
                    </span>
                    <strong className="text-sm text-amber-700">
                      {foliar.severityPercentage.toFixed(1)}%
                    </strong>
                  </div>

                  <div className="bg-slate-50 print:bg-gray-100 p-2.5 rounded-lg border border-slate-200 print:border-gray-300">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">
                      Field Timeline:
                    </span>
                    <strong className="text-sm text-teal-700">
                      Day {foliar.calibratedFieldDays.toFixed(1)}
                    </strong>
                  </div>

                  <div className="bg-slate-50 print:bg-gray-100 p-2.5 rounded-lg border border-slate-200 print:border-gray-300">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">
                      Active Stage:
                    </span>
                    <strong className="text-xs text-slate-800 print:text-black">
                      Stage {foliar.stageOrder} ({foliar.stageLabel})
                    </strong>
                  </div>

                  <div className="bg-slate-50 print:bg-gray-100 p-2.5 rounded-lg border border-slate-200 print:border-gray-300">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">
                      Green Leaf Area:
                    </span>
                    <strong className="text-sm text-emerald-700">
                      {foliar.greenLeafAreaPct.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Microclimate Telemetry Grid */}
            <div className="bg-slate-50 print:bg-gray-100 p-3.5 rounded-xl border border-slate-200 print:border-gray-300">
              <span className="text-xs font-bold text-slate-800 print:text-black block mb-2">
                Field Microclimate Telemetry
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 print:text-gray-600 block">Ambient Temp:</span>
                  <strong className="text-slate-900 print:text-black">{telemetry.temperatureC.toFixed(1)}°C</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 print:text-gray-600 block">Relative Humidity:</span>
                  <strong className="text-slate-900 print:text-black">{telemetry.humidityPct.toFixed(0)}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 print:text-gray-600 block">Rate Multiplier:</span>
                  <strong className="text-teal-700">
                    {telemetry.microclimateMultiplier.toFixed(2)}×
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 print:text-gray-600 block">Status:</span>
                  <strong className="text-xs text-slate-700 print:text-gray-800">
                    {telemetry.environmentalConditionLabel}
                  </strong>
                </div>
              </div>
            </div>

            {/* 4. Intervention & Treatment Advisory Section */}
            <div className="border border-slate-200 print:border-gray-300 rounded-xl p-4 bg-slate-50 print:bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                  Phytosanitary Treatment Advisory
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white print:bg-gray-200 text-slate-700 border border-slate-200">
                  {treatment.isTreatmentSimulated ? 'Intervention Active' : 'Untreated Benchmark'}
                </span>
              </div>

              {treatment.activeProduct && (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <strong className="text-slate-900 print:text-black text-sm">
                        {treatment.activeProduct.tradeName}
                      </strong>
                      <span className="ml-2 font-mono text-[11px] font-bold text-amber-700">
                        {treatment.activeProduct.fracCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 print:text-gray-600 font-mono">
                      PHI: {treatment.activeProduct.preHarvestIntervalDays} days • Rainfast:{' '}
                      {treatment.activeProduct.rainfastnessHours}h
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-700 print:text-gray-700 leading-relaxed">
                    <strong>Mode of Action:</strong> {treatment.activeProduct.modeOfAction}
                  </p>
                  <p className="text-[11px] text-slate-500 print:text-gray-600 italic">
                    <strong>Stewardship:</strong> {treatment.activeProduct.applicationNotes}
                  </p>
                </div>
              )}

              {treatment.isTreatmentSimulated && (
                <div className="pt-2 border-t border-slate-200 print:border-gray-200 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-white print:bg-white p-2 rounded-lg border border-slate-200 print:border-gray-200">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">Yield Salvaged:</span>
                    <strong className="text-teal-700">
                      +{treatment.yieldSalvagedPct.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="bg-white print:bg-white p-2 rounded-lg border border-slate-200 print:border-gray-200">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">Net Economic Benefit:</span>
                    <strong className="text-emerald-700">
                      +${treatment.netEconomicBenefitUSD.toLocaleString()}/ha
                    </strong>
                  </div>
                  <div className="bg-white print:bg-white p-2 rounded-lg border border-slate-200 print:border-gray-200">
                    <span className="text-[10px] text-slate-500 print:text-gray-600 block">Curative Knockdown:</span>
                    <strong className="text-teal-700">
                      {treatment.curativeEfficacyPct}%
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Cultural Sanitization Guidelines */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 print:text-black block">
                Integrated Cultural Sanitation & Disease Management:
              </span>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 print:text-gray-700 leading-relaxed">
                {culturalControls.map((ctl, idx) => (
                  <li key={idx}>{ctl}</li>
                ))}
              </ul>
            </div>

            {/* 6. Document Footer & Disclaimer */}
            <div className="pt-4 border-t border-slate-200 print:border-gray-300 text-[10px] text-slate-400 print:text-gray-500 flex items-center justify-between">
              <span>Precision AgriTech • MobileNetV3-Large & Diffusion Progression Engine</span>
              <span>CONFIDENTIAL • FOR FIELD USE ONLY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
