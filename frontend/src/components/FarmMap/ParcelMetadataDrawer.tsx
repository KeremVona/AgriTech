import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { waterDashboardPath } from '../../utils/irrigationRoutes.ts';
import type { ParcelFormData } from '../../types/parcelMetadata.ts';
import type { ParcelMetrics } from '../../types/farmMapDrawing.ts';
import { calculateDap, resolveCropPalette } from '../../utils/parcelMetadataPolicy.ts';
import {
  getInitialDrawerFormData,
  formatAreaSummary,
  handleDrawerSubmit,
} from '../../utils/parcelDrawerState.ts';
import { BUTTON } from '../Diagnostics/styles.ts';
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

  const rawParcelId = (initialData as any)?.id ?? (initialData as any)?.properties?.id;
  const parcelId = rawParcelId === undefined || rawParcelId === null || rawParcelId === '' ? null : String(rawParcelId);

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
    if (isSaving) return;
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

  const INPUT_BASE =
    'ag-drawer-input w-full min-h-11 px-3.5 py-2.5 rounded-lg border bg-ui-bg text-ui-ink placeholder:text-ui-ink-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-accent disabled:opacity-50 disabled:bg-ui-warm';
  const LABEL = 'block text-[13px] font-medium text-ui-ink-3';

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
        className="ag-drawer-panel font-[family-name:var(--font-ui)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Mobile Grab Handle Bar */}
        <div className="ag-drawer-grab-bar" aria-hidden="true" />

        {/* Header */}
        <header className="ag-drawer-header">
          <h2 id="drawer-title" className="text-lg font-semibold text-ui-ink leading-tight">
            {mode === 'create' ? 'New parcel' : 'Edit parcel'}
          </h2>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ui-ink-2 hover:bg-ui-warm hover:text-ui-ink transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent disabled:opacity-50"
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
          {/* Area summary */}
          <section className="ag-drawer-area-banner" aria-label="Parcel Geometry Summary">
            <div className="text-[32px] font-semibold leading-none tabular-nums text-ui-ink">
              {summary.areaText.split(' (')[0]}
            </div>
            <div className="mt-2 flex gap-4 text-[13px] text-ui-ink-2 tabular-nums">
              <span>{summary.perimeterText.replace(/^Perimeter:\s*/, '')} around</span>
              <span>{summary.verticesText.replace(/^Vertices:\s*/, '')} corners</span>
            </div>
          </section>

          <p className="text-xs text-ui-ink-3">All fields are required.</p>

          {/* 1. Parcel Name Input */}
          <div>
            <label htmlFor="parcel-name-input" className={`${LABEL} mb-1.5`}>
              Name
            </label>
            <input
              id="parcel-name-input"
              aria-required="true"
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
              placeholder="e.g. East field"
              className={`${INPUT_BASE} ${errors.name ? 'border-red-500' : 'border-ui-line'}`}
            />
            {errors.name && (
              <p id="parcel-name-error" className="mt-1.5 text-[13px] text-red-700 font-medium" role="alert">
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
              <label htmlFor="planting-date-input" className={LABEL}>
                Planting date
              </label>
              {dapInfo && dapInfo.stage !== 'Unknown' && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    dapInfo.days < 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-ui-accent-soft text-ui-accent-hover border-ui-accent-line'
                  }`}
                  title="Physiological Growth Stage & Days After Planting"
                >
                  {dapInfo.formatted}
                </span>
              )}
            </div>
            <input
              id="planting-date-input"
              aria-required="true"
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
              className={`${INPUT_BASE} ${errors.plantingDate ? 'border-red-500' : 'border-ui-line'}`}
            />
            {errors.plantingDate && (
              <p id="planting-date-error" className="mt-1.5 text-[13px] text-red-700 font-medium" role="alert">
                {errors.plantingDate}
              </p>
            )}
          </div>

          {/* 5. Map colour preview */}
          <div className="flex items-center gap-2.5 text-[13px] text-ui-ink-2">
            <span
              className="ag-drawer-palette-swatch"
              style={{
                backgroundColor: activePalette.fill,
                border: `2px solid ${activePalette.stroke}`,
              }}
              aria-hidden="true"
            />
            <span>Colour on the map</span>
          </div>
        </form>

        {/* Footer Actions */}
        <footer className="ag-drawer-footer">
          <button
            type="submit"
            form="parcel-metadata-form"
            disabled={isSaving}
            className={`${BUTTON.dark} w-full`}
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>

          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className={`${BUTTON.light} w-full`}
          >
            {mode === 'create' ? 'Discard' : 'Cancel'}
          </button>

          {mode === 'edit' && parcelId && (
            <Link
              to={waterDashboardPath(parcelId, {
                parcelName: formData.name,
                cropName: formData.cropName,
                soilProfileId: formData.soilProfileId,
              })}
              className={`${BUTTON.outline} w-full`}
            >
              Open water dashboard
            </Link>
          )}

          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isSaving}
              className="w-full min-h-11 rounded-full px-4 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete parcel
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
