import type { ParcelFeatureCollection } from '../../types/farmMap.ts';

export interface ParcelListProps {
  parcels: ParcelFeatureCollection['features'];
  selectedId: string | null;
  onSelect: (id: string) => void;
  fallbackReason?: string | null;
}

export function ParcelList({
  parcels,
  selectedId,
  onSelect,
  fallbackReason,
}: ParcelListProps): React.JSX.Element {
  const validParcels = parcels.filter((p) => Boolean(p && p.geometry));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-ag-surface">
      <div className="p-4 border-b border-ag-border bg-ag-surface-muted/50">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ag-ink-secondary">
          Parcels ({validParcels.length})
        </h2>
        {fallbackReason && (
          <div className="mt-2.5 p-2.5 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 leading-relaxed">
            <span className="font-semibold block mb-0.5">Sample data active:</span>
            {fallbackReason}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5" role="list">
        {validParcels.length === 0 ? (
          <div className="p-4 text-center text-sm text-ag-ink-secondary">
            No parcels found.
          </div>
        ) : (
          validParcels.map((parcel) => {
            const id = String(parcel.properties?.id ?? parcel.id ?? '');
            const name = parcel.properties?.name?.trim() || 'Unnamed parcel';
            const cropName = parcel.properties?.crop_name || 'No crop assigned';
            const area =
              typeof parcel.properties?.area_hectares === 'number'
                ? `${parcel.properties.area_hectares.toFixed(2)} ha`
                : '—';
            const isSelected = selectedId === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-pressed={isSelected}
                className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ag-brand ${
                  isSelected
                    ? 'bg-ag-brand-subtle border-ag-brand text-ag-brand-hover shadow-xs font-medium'
                    : 'bg-ag-surface hover:bg-ag-surface-muted border-ag-border text-ag-ink'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{name}</span>
                  <span className="font-mono text-[11px] text-ag-ink-tertiary flex-none">
                    {area}
                  </span>
                </div>
                <div className="text-[11px] text-ag-ink-secondary truncate">
                  {cropName}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
