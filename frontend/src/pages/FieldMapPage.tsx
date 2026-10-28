import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FarmMapContainer } from '../components/FarmMap/FarmMapContainer.tsx';
import { ParcelMetadataDrawer } from '../components/FarmMap/ParcelMetadataDrawer.tsx';
import { useFarmMapData } from '../hooks/useFarmMapData.ts';
import {
  deleteParcelBoundary,
  saveParcel,
  updateParcelMetadata,
} from '../services/farmMapService.ts';
import type { GisDataMode, ParcelFeatureCollection, ParcelMapData } from '../types/farmMap.ts';
import type { ParcelMetrics } from '../types/farmMapDrawing.ts';
import type { ParcelFormData } from '../types/parcelMetadata.ts';
import {
  createDrawnParcelFeature,
  filterParcelsByField,
  formatParcelFeedback,
  getLoadedFields,
  mergeDrawnParcels,
  removeDrawnParcel,
  resolveFarmMapConfig,
  applyGeometryOverrides,
  updateParcelInCollection,
} from '../utils/farmMapPage.ts';
import type { FarmMapConfig } from '../utils/farmMapPage.ts';
import { calculateParcelMetrics } from '../utils/parcelTopology.ts';
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
  config?: FarmMapConfig;
  explicitSample?: boolean;
  configurationError?: boolean;
};

function FieldMapView({
  data,
  loading,
  error,
  reload,
  config,
  explicitSample = false,
  configurationError = false,
}: MapViewProps) {
  const { fieldId } = useParams<{ fieldId: string }>();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Vector drawing & spatial CRUD state machine for TODO-208 and TODO-209
  const [drawnParcels, setDrawnParcels] = useState<GeoJSON.Feature<GeoJSON.Polygon>[]>([]);
  const [parcelOverrides, setParcelOverrides] = useState<Record<string, Partial<ParcelFormData>>>({});
  const [geometryOverrides, setGeometryOverrides] = useState<Record<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedParcel, setSelectedParcel] = useState<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null>(null);
  const [pendingParcel, setPendingParcel] = useState<{ feature: GeoJSON.Feature<GeoJSON.Polygon>; metrics: ParcelMetrics } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const collection = useMemo(() => {
    const base = data?.collection ?? emptyCollection;
    if (Object.keys(parcelOverrides).length === 0 && Object.keys(geometryOverrides).length === 0 && deletedIds.size === 0) {
      return base;
    }
    let current = base;
    if (deletedIds.size > 0) {
      current = {
        ...current,
        features: current.features.filter((f) => {
          const fId = f.id !== undefined && f.id !== null ? String(f.id) : null;
          const pId = f.properties?.id !== undefined && f.properties?.id !== null ? String(f.properties.id) : null;
          return (!fId || !deletedIds.has(fId)) && (!pId || !deletedIds.has(pId));
        }),
      };
    }
    for (const [id, overrides] of Object.entries(parcelOverrides)) {
      current = updateParcelInCollection(current, id, overrides);
    }
    if (Object.keys(geometryOverrides).length > 0) {
      current = applyGeometryOverrides(current, geometryOverrides);
    }
    return current;
  }, [data?.collection, parcelOverrides, geometryOverrides, deletedIds]);

  const fields = useMemo(() => getLoadedFields(collection), [collection]);
  const scopedCollection = useMemo(() => filterParcelsByField(collection, fieldId), [collection, fieldId]);

  const fitCollection = useMemo(
    () => filterParcelsByField(data?.collection ?? emptyCollection, fieldId),
    [data?.collection, fieldId],
  );

  const activeCollection = useMemo(() => {
    return mergeDrawnParcels(scopedCollection, drawnParcels, fieldId);
  }, [scopedCollection, drawnParcels, fieldId]);

  const selectedParcelId = useMemo(() => {
    if (!selectedParcel) return null;
    return selectedParcel.properties?.id ?? selectedParcel.id ?? null;
  }, [selectedParcel]);

  const drawerMetrics = useMemo(() => {
    if (drawerMode === 'create') {
      return pendingParcel?.metrics ?? null;
    }
    if (drawerMode === 'edit' && selectedParcel) {
      const targetId = String(selectedParcel.properties?.id ?? selectedParcel.id);
      const currentParcel = activeCollection.features.find((f) => {
        const fId = f.id !== undefined && f.id !== null ? String(f.id) : null;
        const pId = f.properties?.id !== undefined && f.properties?.id !== null ? String(f.properties.id) : null;
        return fId === targetId || pId === targetId;
      }) ?? selectedParcel;

      if (currentParcel?.geometry) {
        let coords: [number, number][] | null = null;
        if (currentParcel.geometry.type === 'Polygon') {
          coords = currentParcel.geometry.coordinates?.[0] as [number, number][];
        } else if (currentParcel.geometry.type === 'MultiPolygon') {
          coords = currentParcel.geometry.coordinates?.[0]?.[0] as [number, number][];
        }
        if (Array.isArray(coords) && coords.length >= 3) {
          return calculateParcelMetrics(coords);
        }
        if (typeof currentParcel.properties?.area_hectares === 'number') {
          const areaHa = currentParcel.properties.area_hectares;
          return {
            areaM2: areaHa * 10000,
            areaHa,
            acres: areaHa * 2.47105,
            perimeterM: 0,
            vertexCount: 0,
          };
        }
      }
    }
    return null;
  }, [drawerMode, pendingParcel, selectedParcel, activeCollection]);

  const drawerInitialData = useMemo(() => {
    if (drawerMode === 'create') {
      if (!pendingParcel) return null;
      return {
        id: pendingParcel.feature.id,
        name: pendingParcel.feature.properties?.name || '',
        fieldId: pendingParcel.feature.properties?.field_id ?? fieldId ?? null,
      };
    }
    if (drawerMode === 'edit' && selectedParcel) {
      const p = selectedParcel.properties;
      return {
        id: selectedParcel.id ?? p?.id,
        name: p?.name || '',
        cropId: p?.crop_id || '',
        cropName: p?.crop_name || (p as any)?.crop || '',
        crop: p?.crop_name || (p as any)?.crop || '',
        soilProfileId: p?.soil_profile_id || '',
        soilProfileName: p?.soil_profile_name || (p as any)?.soil || '',
        soil: p?.soil_profile_name || (p as any)?.soil || '',
        plantingDate: p?.planting_date || '',
        fieldId: p?.field_id ?? null,
      };
    }
    return null;
  }, [drawerMode, pendingParcel, selectedParcel, fieldId]);

  const handlePolygonComplete = (feature: GeoJSON.Feature<GeoJSON.Polygon>, metrics: ParcelMetrics) => {
    const preparedFeature = createDrawnParcelFeature(feature, metrics, fieldId);
    setDrawnParcels((prev) => [...prev, preparedFeature]);
    setPendingParcel({ feature: preparedFeature, metrics });
    setSelectedParcel(preparedFeature);
    setDrawerMode('create');
    setIsDrawerOpen(true);
    setFeedbackNotice(formatParcelFeedback('complete', metrics));
  };

  const handleParcelSelect = (feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) => {
    if (drawerMode === 'create' && pendingParcel) {
      const pendingId = pendingParcel.feature.id ?? pendingParcel.feature.properties?.id;
      if (pendingId !== undefined && pendingId !== null) {
        setDrawnParcels((prev) => removeDrawnParcel(prev, pendingId));
      }
      setPendingParcel(null);
    }
    setSelectedParcel(feature);
    setDrawerMode('edit');
    setIsDrawerOpen(true);
  };

  const deleteParcel = async (targetId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const effectiveConfig = config ?? configuration.config ?? {
        apiBaseUrl: 'http://localhost:5051',
        parcelsPath: '/api/v1/spatial/geojson/parcels',
        mode: 'auto',
      };
      const writeMode: GisDataMode = data?.source === 'sample' ? 'sample' : effectiveConfig.mode;
      const isLocalOnly = writeMode === 'sample';

      await deleteParcelBoundary({
        apiBaseUrl: effectiveConfig.apiBaseUrl,
        mode: writeMode,
        parcelId: targetId,
      });

      setDrawnParcels((prev) => removeDrawnParcel(prev, targetId));
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
      setParcelOverrides((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setGeometryOverrides((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });

      if (selectedParcel) {
        const selId = String(selectedParcel.properties?.id ?? selectedParcel.id);
        if (selId === targetId) {
          setSelectedParcel(null);
          setIsDrawerOpen(false);
        }
      }

      setFeedbackNotice(formatParcelFeedback('delete', { localOnly: isLocalOnly }));
    } catch (err: any) {
      setRenderVersion((v) => v + 1);
      setFeedbackNotice({
        type: 'info',
        message: `Failed to delete parcel: ${err?.message ?? 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolygonDelete = async (parcelId: string | number) => {
    if (isSaving) return;
    const targetStr = String(parcelId);

    // Ignore pm:remove events for layers that are not parcels
    const matchingParcel = activeCollection.features.find((f) => {
      const fId = f.id !== undefined && f.id !== null ? String(f.id) : null;
      const pId = f.properties?.id !== undefined && f.properties?.id !== null ? String(f.properties.id) : null;
      return fId === targetStr || pId === targetStr;
    });
    if (!matchingParcel) {
      return;
    }

    const pendingIdStr = pendingParcel ? String(pendingParcel.feature.id ?? pendingParcel.feature.properties?.id) : null;
    const isPending = pendingParcel && pendingIdStr === targetStr;

    if (isPending) {
      setPendingParcel(null);
      setDrawnParcels((prev) => removeDrawnParcel(prev, targetStr));
      if (selectedParcel) {
        const selId = String(selectedParcel.properties?.id ?? selectedParcel.id);
        if (selId === targetStr) {
          setSelectedParcel(null);
          setIsDrawerOpen(false);
        }
      }
      setFeedbackNotice(formatParcelFeedback('delete'));
      return;
    }

    await deleteParcel(targetStr);
  };

  const handleParcelGeometryChange = (id: string, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => {
    const pendingId = pendingParcel ? String(pendingParcel.feature.id ?? pendingParcel.feature.properties?.id) : null;
    if (pendingParcel && pendingId === id) {
      const coords = geometry.type === 'Polygon' ? (geometry.coordinates[0] as [number, number][]) : (geometry.coordinates[0]?.[0] as [number, number][]);
      const metrics = calculateParcelMetrics(coords);
      const updatedFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
        ...pendingParcel.feature,
        geometry: geometry as GeoJSON.Polygon,
      };
      setPendingParcel({ feature: updatedFeature, metrics });
      setSelectedParcel(updatedFeature);
      setDrawnParcels((prev) =>
        prev.map((p) => {
          const pId = String(p.id ?? p.properties?.id);
          return pId === id ? { ...p, geometry: geometry as GeoJSON.Polygon } : p;
        })
      );
      return;
    }

    setGeometryOverrides((prev) => ({
      ...prev,
      [id]: geometry,
    }));
    setDrawnParcels((prev) =>
      prev.map((p) => {
        const pId = String(p.id ?? p.properties?.id);
        return pId === id ? { ...p, geometry: geometry as GeoJSON.Polygon } : p;
      })
    );
  };

  const handleDrawerDiscard = () => {
    if (drawerMode === 'create' && pendingParcel) {
      const pendingId = pendingParcel.feature.id ?? pendingParcel.feature.properties?.id;
      if (pendingId !== undefined && pendingId !== null) {
        setDrawnParcels((prev) => removeDrawnParcel(prev, pendingId));
      }
      setPendingParcel(null);
    }
    setSelectedParcel(null);
    setIsDrawerOpen(false);
  };

  const handleDrawerSave = async (formData: ParcelFormData) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const effectiveConfig = config ?? configuration.config ?? {
        apiBaseUrl: 'http://localhost:5051',
        parcelsPath: '/api/v1/spatial/geojson/parcels',
        mode: 'auto',
      };
      const writeMode: GisDataMode = data?.source === 'sample' ? 'sample' : effectiveConfig.mode;
      const isLocalOnly = writeMode === 'sample';

      if (drawerMode === 'create' && pendingParcel) {
        const saved = await saveParcel({
          apiBaseUrl: effectiveConfig.apiBaseUrl,
          mode: writeMode,
          parcel: formData,
          geometry: pendingParcel.feature.geometry,
          areaHa: pendingParcel.metrics.areaHa,
          fieldId: formData.fieldId ?? fieldId ?? null,
        });

        const pendingId = pendingParcel.feature.id ?? pendingParcel.feature.properties?.id;
        setDrawnParcels((prev) => {
          const filtered = pendingId !== undefined && pendingId !== null
            ? removeDrawnParcel(prev, pendingId)
            : prev;
          return [...filtered, saved];
        });

        setPendingParcel(null);
        setSelectedParcel(null);
        setIsDrawerOpen(false);
        setFeedbackNotice(formatParcelFeedback('register', { localOnly: isLocalOnly }));
      } else if (drawerMode === 'edit' && selectedParcel) {
        const targetId = String(selectedParcel.properties?.id ?? selectedParcel.id);
        const currentParcel = activeCollection.features.find((f) => {
          const fId = f.id !== undefined && f.id !== null ? String(f.id) : null;
          const pId = f.properties?.id !== undefined && f.properties?.id !== null ? String(f.properties.id) : null;
          return fId === targetId || pId === targetId;
        }) ?? selectedParcel;
        const currentGeometry = currentParcel.geometry;
        const areaHa = drawerMetrics?.areaHa ?? currentParcel.properties?.area_hectares ?? 0;

        await updateParcelMetadata({
          apiBaseUrl: effectiveConfig.apiBaseUrl,
          mode: writeMode,
          parcelId: targetId,
          data: formData,
          geometry: currentGeometry,
          areaHa,
        });

        setDrawnParcels((prev) =>
          updateParcelInCollection(
            { type: 'FeatureCollection', features: prev } as ParcelFeatureCollection,
            targetId,
            formData
          ).features as GeoJSON.Feature<GeoJSON.Polygon>[]
        );

        setParcelOverrides((prev) => ({
          ...prev,
          [targetId]: formData,
        }));

        setSelectedParcel(null);
        setIsDrawerOpen(false);
        setFeedbackNotice(formatParcelFeedback('update', { localOnly: isLocalOnly }));
      }
    } catch (err: any) {
      setFeedbackNotice({
        type: 'info',
        message: `Failed to save parcel: ${err?.message ?? 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDrawerDelete = async () => {
    if (!selectedParcel || isSaving) return;
    const targetId = String(selectedParcel.properties?.id ?? selectedParcel.id);
    await deleteParcel(targetId);
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

  const noticeTitle =
    feedbackNotice?.message.startsWith('Failed')
      ? 'Action Failed'
      : feedbackNotice?.type === 'info'
      ? 'Parcel Removed'
      : feedbackNotice?.message.includes('registered') || feedbackNotice?.message.includes('saved')
      ? 'Parcel Registered'
      : feedbackNotice?.message.includes('updated')
      ? 'Parcel Updated'
      : 'Parcel Boundary Recorded';

  return (
    <div
      className="ag-field-map-page"
      data-fallback={data?.fallbackReason ? true : undefined}
      data-pending-parcel={pendingParcel ? String(pendingParcel.feature.id) : undefined}
      data-selected-parcel={selectedParcel ? String(selectedParcel.properties?.id ?? selectedParcel.id) : undefined}
      data-drawer-open={isDrawerOpen ? true : undefined}
      data-drawer-mode={isDrawerOpen ? drawerMode : undefined}
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
          fitCollection={fitCollection}
          editable={Boolean(fieldId)}
          renderVersion={renderVersion}
          selectedParcelId={selectedParcelId}
          onParcelSelect={handleParcelSelect}
          onParcelGeometryChange={handleParcelGeometryChange}
          onPolygonComplete={handlePolygonComplete}
          onPolygonDelete={handlePolygonDelete}
        />
        <ParcelMetadataDrawer
          isOpen={isDrawerOpen}
          mode={drawerMode}
          initialData={drawerInitialData}
          metrics={drawerMetrics}
          onSave={handleDrawerSave}
          onDiscard={handleDrawerDiscard}
          onDelete={drawerMode === 'edit' ? handleDrawerDelete : undefined}
          isSaving={isSaving}
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
                  <h2>{noticeTitle}</h2>
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
  return <FieldMapView {...state} config={config} explicitSample={config.mode === 'sample'} />;
}

export function FieldMapPage(): React.JSX.Element {
  return configuration.config
    ? <LoadedFieldMap config={configuration.config} />
    : <FieldMapView data={null} loading={false} error={configuration.error} configurationError reload={() => window.location.reload()} />;
}
