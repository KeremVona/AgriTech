import { Link } from 'react-router-dom';
import { useNow } from '../../hooks/useNow.ts';
import {
  computeDeficit,
  estimateTrigger,
  gaugeAngleDeg,
  gaugeAriaValueNow,
  isStale,
  zoneTone,
} from '../../models/waterBalanceModel.ts';
import type { DeficitZone, TriggerEstimate } from '../../models/waterBalanceModel.ts';
import './irrigation.css';

export interface DeficitGaugeProps {
  currentMoisture: number | null;
  fieldCapacity: number | null;
  wiltingPoint: number | null;
  mad: number | null;
  hoursUntilTrigger?: number | null;
  recentSamples?: { timestamp: string; soilMoisturePct: number | null }[];
  latestReadingAt?: string | null;
  nowMs?: number;
}

const ZONE_LABELS: Record<DeficitZone, string> = {
  comfortable: 'Comfortable',
  watch: 'Watch',
  'irrigation-soon': 'Irrigation soon',
  stress: 'Water stress',
};

const TONE_STYLES = {
  green: { stroke: '#10B981', pill: 'bg-emerald-50 text-emerald-800' },
  yellow: { stroke: '#F59E0B', pill: 'bg-amber-50 text-amber-800' },
  red: { stroke: '#EF4444', pill: 'bg-red-50 text-red-800' },
} as const;

const CX = 120;
const CY = 120;
const RADIUS = 96;

function polar(angleDeg: number, radius = RADIUS): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(startDeg);
  const [x2, y2] = polar(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function ZoneIcon({ zone }: { zone: DeficitZone }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (zone === 'comfortable') {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
  }
  if (zone === 'stress') {
    return <svg {...common}><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" /><path d="M12 8v4M12 16h.01" /></svg>;
  }
  return <svg {...common}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></svg>;
}

function formatHours(hours: number): string {
  return hours < 10 ? hours.toFixed(1) : String(Math.round(hours));
}

function triggerText(estimate: TriggerEstimate): string {
  switch (estimate.kind) {
    case 'hours': return `Automatic irrigation in ~${formatHours(estimate.hours)} h`;
    case 'reached': return 'Refill point reached';
    case 'not-drying': return 'Not drying — no trigger expected';
    case 'unknown': return 'Not enough data to estimate';
  }
}

function MissingState({ title, body }: { title: string; body?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ui-line bg-ui-warm p-4 text-sm">
      <p className="font-medium text-ui-ink">{title}</p>
      {body && <p className="mt-1 text-ui-ink-2">{body}</p>}
    </div>
  );
}

/** Root-zone depletion relative to Readily Available Water (TODO-309). */
export function DeficitGauge({
  currentMoisture,
  fieldCapacity,
  wiltingPoint,
  mad,
  hoursUntilTrigger = null,
  recentSamples = [],
  latestReadingAt = null,
  nowMs: nowProp,
}: DeficitGaugeProps): React.JSX.Element {
  const ticking = useNow(60_000, nowProp === undefined);
  const nowMs = nowProp ?? ticking;
  if (fieldCapacity === null || wiltingPoint === null || mad === null) {
    return (
      <MissingState
        title="Soil profile not set"
        body={<>Assign one on the <Link to="/map" className="font-medium text-ui-accent-hover underline underline-offset-2">field map</Link> to see the water budget.</>}
      />
    );
  }
  if (currentMoisture === null) {
    return <MissingState title="No soil moisture readings yet" body="The gauge appears once the parcel's probe reports." />;
  }

  const deficit = computeDeficit({ fieldCapacityPct: fieldCapacity, wiltingPointPct: wiltingPoint, saturationPct: fieldCapacity, madFraction: mad, currentMoisturePct: currentMoisture });
  const tone = TONE_STYLES[zoneTone(deficit.zone)];
  const percentOfRaw = Math.round(deficit.ratio * 100);
  const label = ZONE_LABELS[deficit.zone];
  const estimate = estimateTrigger({ samples: recentSamples, currentMoisturePct: currentMoisture, madThresholdPct: deficit.madThresholdPct, apiHours: hoursUntilTrigger });
  const stale = isStale(latestReadingAt, nowMs);
  const staleHours = latestReadingAt ? Math.max(0, Math.floor((nowMs - Date.parse(latestReadingAt)) / 3_600_000)) : null;
  const angle = gaugeAngleDeg(deficit.ratio);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="meter"
        aria-label="Root-zone water depletion"
        aria-valuemin={0}
        aria-valuemax={150}
        aria-valuenow={gaugeAriaValueNow(deficit.ratio)}
        aria-valuetext={`${percentOfRaw} % of the way to the refill point — ${label.toLowerCase()}`}
        className="relative w-full max-w-[260px]"
      >
        <svg viewBox="0 0 240 200" className="w-full" aria-hidden="true">
          <path d={arcPath(-120, 120)} stroke="#EDEBE8" strokeWidth="20" fill="none" />
          <path d={arcPath(-120, -40)} stroke={TONE_STYLES.green.stroke} strokeWidth="16" fill="none" />
          <path d={arcPath(-40, 40)} stroke={TONE_STYLES.yellow.stroke} strokeWidth="16" fill="none" />
          <path d={arcPath(40, 120)} stroke={TONE_STYLES.red.stroke} strokeWidth="16" fill="none" />
          {[-40, 40].map((tick) => {
            const [x1, y1] = polar(tick, RADIUS - 12);
            const [x2, y2] = polar(tick, RADIUS + 12);
            return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeWidth="3" />;
          })}
          <g className="ag-gauge-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <line x1={CX} y1={CY} x2={CX} y2={CY - RADIUS + 14} stroke="#191918" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx={CX} cy={CY - RADIUS} r="9" fill={tone.stroke} stroke="#FFFFFF" strokeWidth="3" />
          </g>
          <circle cx={CX} cy={CY} r="6" fill="#191918" />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
          <p className="text-[28px] font-medium leading-tight tracking-tight tabular-nums text-ui-ink">{percentOfRaw}%</p>
          <p className="text-xs text-ui-ink-3">of the way to the refill point</p>
        </div>
      </div>

      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${tone.pill}`}>
        <ZoneIcon zone={deficit.zone} />
        {label}
      </span>

      <p className="text-center text-[15px] font-medium text-ui-ink">{triggerText(estimate)}</p>

      <dl className="mt-1 grid w-full grid-cols-3 gap-2 border-t border-ui-line pt-4 text-center">
        <div>
          <dt className="text-xs text-ui-ink-3">Moisture</dt>
          <dd className="mt-0.5 text-[17px] font-medium tabular-nums text-ui-ink">{currentMoisture.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-ui-ink-3">Full at</dt>
          <dd className="mt-0.5 text-[17px] font-medium tabular-nums text-ui-ink">{fieldCapacity.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-ui-ink-3">Refill at</dt>
          <dd className="mt-0.5 text-[17px] font-medium tabular-nums text-ui-ink">{deficit.madThresholdPct.toFixed(1)}%</dd>
        </div>
      </dl>

      {stale && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          {staleHours === null ? 'No recent reading' : `Last reading ${staleHours} h ago`}
        </span>
      )}
    </div>
  );
}
