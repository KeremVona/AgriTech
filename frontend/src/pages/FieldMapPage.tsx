import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FarmMapContainer } from '../components/FarmMap/FarmMapContainer.tsx';
import { useFarmMapData } from '../hooks/useFarmMapData.ts';
import type { ParcelFeatureCollection, ParcelMapData } from '../types/farmMap.ts';
import type { ParcelMetrics } from '../types/farmMapDrawing.ts';
import {
  createDrawnParcelFeature,
  filterParcelsByField,
  formatParcelFeedback,
  getLoadedFields,
  mergeDrawnParcels,
  removeDrawnParcel,
  resolveFarmMapConfig,
} from '../utils/farmMapPage.ts';
import type { FarmMapConfig } from '../utils/farmMapPage.ts';
import './fieldMapPage.css';

const configuration = resolveFarmMapConfig({
  VITE_GIS_API_BASE_URL: import.meta.env.VITE_GIS_API_BASE_URL,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_GIS_PARCELS_PATH: import.meta.env.VITE_GIS_PARCELS_PATH,
  VITE_GIS_DATA_MODE: import.meta.env.VITE_GIS_DATA_MODE,
});
const emptyCollection: ParcelFeatureCollection = { type: 'FeatureCollection', features: [] };

type MapViewProps = {
  data: ParcelMapData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  explicitSample?: boolean;
  configurationError?: boolean;
};

function FieldMapView({ data, loading, error, reload, explicitSample = false, configurationError = false }: MapViewProps) {
  const { fieldId } = useParams<{ fieldId: string }>();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Vector drawing state for TODO-208
  const [drawnParcels, setDrawnParcels] = useState<GeoJSON.Feature<GeoJSON.Polygon>[]>([]);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [pendingParcel, setPendingParcel] = useState<{ feature: GeoJSON.Feature<GeoJSON.Polygon>; metrics: ParcelMetrics } | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const collection = data?.collection ?? emptyCollection;
  const fields = useMemo(() => getLoadedFields(collection), [collection]);
  const scopedCollection = useMemo(() => filterParcelsByField(collection, fieldId), [collection, fieldId]);

  const activeCollection = useMemo(() => {
    return mergeDrawnParcels(scopedCollection, drawnParcels, fieldId);
  }, [scopedCollection, drawnParcels, fieldId]);

  const handlePolygonComplete = (feature: GeoJSON.Feature<GeoJSON.Polygon>, metrics: ParcelMetrics) => {
    const preparedFeature = createDrawnParcelFeature(feature, metrics, fieldId);
    setDrawnParcels((prev) => [...prev, preparedFeature]);
    setPendingParcel({ feature: preparedFeature, metrics });
    setFeedbackNotice(formatParcelFeedback('complete', metrics));
  };

  const handlePolygonDelete = (parcelId: string | number) => {
    setDrawnParcels((prev) => removeDrawnParcel(prev, parcelId));
    setPendingParcel((curr) => {
      if (curr) {
        const targetStr = String(parcelId);
        const currIdStr = curr.feature.id !== undefined && curr.feature.id !== null ? String(curr.feature.id) : null;
        const currPropIdStr = curr.feature.properties?.id !== undefined && curr.feature.properties?.id !== null ? String(curr.feature.properties.id) : null;
        if (currIdStr === targetStr || currPropIdStr === targetStr) {
          return null;
        }
      }
      return curr;
    });
    setFeedbackNotice(formatParcelFeedback('delete'));
  };

  const unknownField = fieldId !== undefined && !fields.some(({ id }) => id === fieldId);
  const source = data?.source === 'api' ? 'Live data' : data ? 'Sample data' : configurationError ? 'Configuration error' : error ? 'Data unavailable' : 'Loading parcels…';
  const sourceDetail = data?.fallbackReason ? 'Sample data — live data unavailable' : source;
  const retryLabel = configurationError ? 'Reload page' : loading ? 'Retrying…' : data?.fallbackReason ? 'Retry live data' : 'Retry data';
  const count = `${scopedCollection.features.length} loaded parcel${scopedCollection.features.length === 1 ? '' : 's'}${fieldId ? ' in this field' : ''}${drawnParcels.length > 0 ? ` · ${drawnParcels.length} drawn` : ''}`;
  const status = <>
    <div role="status" aria-live="polite">
      <strong>{sourceDetail}</strong>
      <span className="ag-field-map-count">{data ? count : loading ? 'Requesting parcel boundaries' : 'No parcel data loaded'}{loading && data ? ' · Retrying live data…' : ''}</span>
    </div>
    {!explicitSample && <button type="button" className="ag-field-map-button" onClick={reload} disabled={loading}>{retryLabel}</button>}
  </>;

  return (
    <div
      className="ag-field-map-page"
      data-fallback={data?.fallbackReason ? true : undefined}
      data-pending-parcel={pendingParcel ? String(pendingParcel.feature.id) : undefined}
    >
      <header className="ag-field-map-header">
        <Link to="/" className={`ag-field-map-button ag-field-map-home${explicitSample ? '' : ' ag-field-map-desktop-home'}`} aria-label="AgriTech home" title="Home">←</Link>
        {!explicitSample && <button type="button" className="ag-field-map-button ag-field-map-mobile-refresh" onClick={reload} disabled={loading} aria-label={retryLabel} title={retryLabel}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 7v5h-5" /><path d="M20 12a8 8 0 1 0-2.3 5.7M20 7l-2.3-2.3" />
          </svg>
        </button>}
        <div className="ag-field-map-heading">
          <h1>Field GIS</h1>
          <span className="ag-field-map-mobile-source" role="status" aria-label={sourceDetail}>{loading && data ? 'Retrying…' : sourceDetail}</span>
          {data && <span className="ag-field-map-mobile-count">{activeCollection.features.length} loaded</span>}
        </div>
        <div className="ag-field-map-selector">
          <label htmlFor="map-field">Field</label>
          <select id="map-field" value={fieldId ?? ''} onChange={(event) => navigate(event.target.value ? `/fields/${encodeURIComponent(event.target.value)}/parcels` : '/map')}>
            <option value="">All fields</option>
            {unknownField && <option value={fieldId}>Field not in loaded data</option>}
            {fields.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="ag-field-map-desktop-status">{status}</div>
        <details ref={menuRef} className="ag-field-map-menu" onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false;
            event.currentTarget.querySelector('summary')?.focus();
          }
        }}>
          <summary className="ag-field-map-button" aria-label="Map information and navigation" title="Map information and navigation">⋯</summary>
          <div className="ag-field-map-menu-panel">
            <div className="ag-field-map-menu-data">{status}</div>
            {data?.source === 'sample' && <p className="ag-field-map-sample-info">Fictional demonstration parcels in rural Türkiye. Remote imagery requires a network connection.</p>}
            <nav aria-label="Production modules">
              <Link to="/">Home</Link>
              <Link to="/diagnostics">AI Leaf Diagnostics</Link>
              <Link to="/disease-progression">Disease Progression</Link>
            </nav>
          </div>
        </details>
      </header>

      <main className="ag-field-map-workspace">
        <FarmMapContainer
          collection={activeCollection}
          editable
          onPolygonComplete={handlePolygonComplete}
          onPolygonDelete={handlePolygonDelete}
        />
        <div className="ag-field-map-notices">
          {feedbackNotice && (
            <section
              className={`ag-field-map-notice ag-field-map-notice-${feedbackNotice.type}`}
              role="status"
              aria-live="polite"
            >
              <div className="ag-field-map-notice-content">
                <div>
                  <h2>{feedbackNotice.type === 'success' ? 'Parcel Boundary Recorded' : 'Parcel Removed'}</h2>
                  <p>{feedbackNotice.message}</p>
                </div>
                <button
                  type="button"
                  className="ag-field-map-notice-dismiss"
                  onClick={() => setFeedbackNotice(null)}
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </section>
          )}
          {error && <section className="ag-field-map-notice" role="alert">
            <h2>{configurationError ? 'Map configuration error' : data ? 'Parcel data could not be updated' : 'Parcel data unavailable'}</h2>
            <p>{error}</p>
            {data && <p>Previously loaded {data.source === 'api' ? 'live' : 'sample'} boundaries remain visible.</p>}
            <button type="button" className="ag-field-map-button" onClick={reload} disabled={loading}>{retryLabel}</button>
          </section>}
          {!error && loading && !data && <section className="ag-field-map-notice" role="status"><h2>Loading parcel boundaries…</h2><p>The map remains available while data loads.</p></section>}
          {data && !error && !loading && activeCollection.features.length === 0 && <section className="ag-field-map-notice" role="status">
            <h2>{fieldId ? 'No loaded parcels for this field' : 'No parcels returned by the live API'}</h2>
            <p>{fieldId ? 'This field has no matching records in the loaded collection.' : 'The live collection is empty. No sample records have been substituted.'}</p>
            {fieldId && <Link className="ag-field-map-button" to="/map">View all loaded parcels</Link>}
          </section>}
        </div>
      </main>
    </div>
  );
}

function LoadedFieldMap({ config }: { config: FarmMapConfig }) {
  const state = useFarmMapData(config);
  return <FieldMapView {...state} explicitSample={config.mode === 'sample'} />;
}

export function FieldMapPage(): React.JSX.Element {
  return configuration.config
    ? <LoadedFieldMap config={configuration.config} />
    : <FieldMapView data={null} loading={false} error={configuration.error} configurationError reload={() => window.location.reload()} />;
}
