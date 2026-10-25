import React, { useEffect, useRef, useState } from 'react';
import type { ParcelFormData } from '../../types/parcelMetadata.ts';
import type { ParcelMetrics } from '../../types/farmMapDrawing.ts';
import { calculateDap, resolveCropPalette } from '../../utils/parcelMetadataPolicy.ts';
import {
  getInitialDrawerFormData,
  formatAreaSummary,
  handleDrawerSubmit,
} from '../../utils/parcelDrawerState.ts';
import { CropSelector } from './CropSelector.tsx';
import { SoilSelector } from './SoilSelector.tsx';
import './farmMapDrawer.css';

export interface ParcelMetadataDrawerProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<ParcelFormData> | null;
  metrics?: ParcelMetrics | null;
  onSave: (data: ParcelFormData) => Promise<void> | void;
  onDiscard: () => void;
  onDelete?: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * Sliding parcel metadata drawer presenting geometry metrics,
 * canonical crop selection, soil texture profile, DAP calculation,
 * and live boundary styling preview.
 */
export function ParcelMetadataDrawer({
  isOpen,
  mode,
  initialData,
  metrics,
  onSave,
  onDiscard,
  onDelete,
  isSaving = false,
}: ParcelMetadataDrawerProps): React.JSX.Element | null {
  const currentInitialKey =
    (initialData as any)?.id ??
    (initialData as any)?.properties?.id ??
    initialData?.name ??
    '';

  const [formData, setFormData] = useState<ParcelFormData>(() =>
    getInitialDrawerFormData(mode, initialData),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ParcelFormData, string>>>({});
  const [syncState, setSyncState] = useState(() => ({
    isOpen,
    mode,
    initialKey: currentInitialKey,
  }));
  const panelRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Synchronize form state during render only when:
  // 1) drawer transitions from closed to open (!syncState.isOpen && isOpen)
  // 2) mode changes (create <-> edit)
  // 3) stable initialData ID/name changes
  // This explicitly prevents wiping out user typing on parent re-renders that pass new object references.
  if (
    (!syncState.isOpen && isOpen) ||
    syncState.mode !== mode ||
    syncState.initialKey !== currentInitialKey
  ) {
    setSyncState({
      isOpen,
      mode,
      initialKey: currentInitialKey,
    });
    setFormData(getInitialDrawerFormData(mode, initialData));
    setErrors({});
  } else if (syncState.isOpen !== isOpen) {
    setSyncState((prev) => ({ ...prev, isOpen }));
  }

  // Autofocus parcel name input on modal reveal
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Focus trapping and keyboard accessibility (Tab, Shift+Tab, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard Escape dismissal with !isSaving
      if (e.key === 'Escape' && !isSaving) {
        e.preventDefault();
        onDiscard();
        return;
      }

      // Trap focus within drawer dialog
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;

        const focusableSelector =
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(
          panel.querySelectorAll<HTMLElement>(focusableSelector),
        ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !panel.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !panel.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onDiscard]);

  if (!isOpen) {
    return null;
  }

  const dapInfo = calculateDap(formData.plantingDate);
  const activePalette = resolveCropPalette(formData.cropName || formData.cropId || formData.crop);
  const summary = formatAreaSummary(metrics);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = handleDrawerSubmit(formData);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await onSave(result.data!);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onDiscard();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="ag-drawer-backdrop"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        ref={panelRef}
        className="ag-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Mobile Grab Handle Bar */}
        <div className="ag-drawer-grab-bar" aria-hidden="true" />

        {/* Header */}
        <header className="ag-drawer-header">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={isSaving}
              className="p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
              aria-label="Back to map"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 id="drawer-title" className="text-base font-bold text-slate-900 leading-tight">
              {mode === 'create' ? 'Parcel Setup' : 'Edit Parcel Metadata'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
            aria-label="Close drawer"
            title="Close drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Form Body */}
        <form id="parcel-metadata-form" onSubmit={handleSubmit} className="ag-drawer-body">
          {/* Area Summary Banner */}
          <section className="ag-drawer-area-banner" aria-label="Parcel Geometry Summary">
            <div className="flex items-center justify-between text-xs font-semibold text-teal-950">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 20l-5.447-2.724A2 2 0 013 15.485V4.515a2 2 0 011.553-1.96L9 1m0 19l6-3m-6 3V1m6 16l5.447 2.724A2 2 0 0022 18.485V7.515a2 2 0 00-1.553-1.96L15 4m0 13V4m0 0L9 1"
                  />
                </svg>
                Boundary Geometry
              </span>
              <span className="text-[11px] font-mono text-teal-800 bg-teal-100/90 font-medium px-2 py-0.5 rounded-full border border-teal-200">
                {summary.verticesText}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-white/90 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                  Calculated Area
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                  {summary.areaText}
                </div>
              </div>
              <div className="bg-white/90 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                  Perimeter
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                  {summary.perimeterText.replace(/^Perimeter:\s*/, '')}
                </div>
              </div>
            </div>
          </section>

          {/* 1. Parcel Name Input */}
          <div>
            <label
              htmlFor="parcel-name-input"
              className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5"
            >
              Parcel Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="parcel-name-input"
              ref={nameInputRef}
              type="text"
              value={formData.name}
              disabled={isSaving}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'parcel-name-error' : undefined}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              placeholder="e.g., P-04 - East Valley Corn"
              className={`ag-drawer-input w-full px-3.5 py-2.5 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
            {errors.name && (
              <p id="parcel-name-error" className="mt-1.5 text-xs text-rose-600 font-medium" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* 2. Crop Selector */}
          <CropSelector
            selectedCropId={formData.cropId || formData.cropName || formData.crop}
            disabled={isSaving}
            onChange={(crop) => {
              setFormData((prev) => ({
                ...prev,
                cropId: crop.id,
                cropName: crop.name,
                crop: crop.name,
              }));
              if (errors.cropId || errors.cropName || errors.crop) {
                setErrors((prev) => ({
                  ...prev,
                  cropId: undefined,
                  cropName: undefined,
                  crop: undefined,
                }));
              }
            }}
            error={errors.cropId || errors.cropName || errors.crop}
          />

          {/* 3. Soil Selector */}
          <SoilSelector
            selectedSoilId={formData.soilProfileId || formData.soilProfileName || formData.soil}
            disabled={isSaving}
            onChange={(soil) => {
              setFormData((prev) => ({
                ...prev,
                soilProfileId: soil.id,
                soilProfileName: soil.name,
                soil: soil.name,
              }));
              if (errors.soilProfileId || errors.soilProfileName || errors.soil) {
                setErrors((prev) => ({
                  ...prev,
                  soilProfileId: undefined,
                  soilProfileName: undefined,
                  soil: undefined,
                }));
              }
            }}
            error={errors.soilProfileId || errors.soilProfileName || errors.soil}
          />

          {/* 4. Planting Date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="planting-date-input"
                className="block text-xs font-semibold text-slate-700 tracking-wide uppercase"
              >
                Planting Date <span className="text-rose-500">*</span>
              </label>
              {dapInfo && dapInfo.stage !== 'Unknown' && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                    dapInfo.days < 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                  title="Physiological Growth Stage & Days After Planting"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      dapInfo.days < 0 ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  {dapInfo.formatted}
                </span>
              )}
            </div>
            <input
              id="planting-date-input"
              type="date"
              value={formData.plantingDate}
              disabled={isSaving}
              aria-invalid={Boolean(errors.plantingDate)}
              aria-describedby={errors.plantingDate ? 'planting-date-error' : undefined}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, plantingDate: e.target.value }));
                if (errors.plantingDate) {
                  setErrors((prev) => ({ ...prev, plantingDate: undefined }));
                }
              }}
              className={`ag-drawer-input w-full px-3.5 py-2.5 rounded-xl border bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
                errors.plantingDate
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-teal-600 focus:ring-teal-100'
              } disabled:opacity-50 disabled:bg-slate-50`}
            />
            {errors.plantingDate && (
              <p id="planting-date-error" className="mt-1.5 text-xs text-rose-600 font-medium" role="alert">
                {errors.plantingDate}
              </p>
            )}
          </div>

          {/* 5. Crop Palette Preview Bar */}
          <div>
            <div className="text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5">
              Live Map Styling Preview
            </div>
            <div className="ag-drawer-palette-preview">
              <div className="flex items-center gap-2">
                <div
                  className="ag-drawer-palette-swatch flex items-center justify-center text-[10px] font-semibold"
                  style={{
                    backgroundColor: activePalette.fill,
                    border: `2px solid ${activePalette.stroke}`,
                  }}
                />
                <span className="text-slate-600 font-mono text-[11px]">
                  Stroke: <strong className="text-slate-800">{activePalette.stroke}</strong> | Fill: 18%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-sans">
                {formData.cropName || 'Default'}
              </span>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <footer className="ag-drawer-footer">
          <button
            type="submit"
            form="parcel-metadata-form"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.99] transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving Parcel...
              </>
            ) : mode === 'create' ? (
              'Save Parcel Boundary'
            ) : (
              'Update Parcel Metadata'
            )}
          </button>

          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'create' ? 'Discard Boundary' : 'Cancel'}
          </button>

          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isSaving}
              className="w-full py-2 px-4 rounded-xl font-medium text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              Delete Parcel
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
