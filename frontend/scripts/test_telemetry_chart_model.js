import assert from 'node:assert/strict';
import {
  buildChartRows,
  chartAriaLabel,
  computeAxisDomains,
  formatBucketLabel,
  latestValuesSummary,
  soilBands,
  tooltipLines,
} from '../src/models/telemetryChartModel.ts';

let failures = 0;
let tests = 0;

function test(name, run) {
  tests++;
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const soil = { fieldCapacityPct: 32, wiltingPointPct: 12, saturationPct: 43, madFraction: 0.5 };
const day = (d) => new Date(Date.UTC(2026, 10, d)).toISOString();
const point = (timestamp, soilMoisturePct, extra = {}) => ({
  timestamp, soilMoisturePct, etcMm: 4.1, effectiveRainMm: 0, irrigationMm: 0, isForecast: false, ...extra,
});

const fixture7d = {
  parcelId: 'p-1',
  window: '7d',
  resolution: 'day',
  soil,
  points: [
    point(day(14), 27.1),
    point(day(15), 25.0, { irrigationMm: 12 }),
    point(day(16), 23.4),
    point(day(17), 22.0, { isForecast: true }),
    point(day(18), null, { isForecast: true }),
  ],
  irrigationEvents: [{
    id: 'e-1', triggerType: 'AUTOMATED_DEFICIT', status: 'COMPLETED',
    scheduledStart: '2026-11-15T06:00:00Z', actualStart: '2026-11-15T06:10:00Z', completedAt: '2026-11-15T06:55:00Z',
    durationMinutes: 45, waterVolumeLiters: 14200,
  }],
};

const fixtureWithGap = {
  ...fixture7d,
  points: [point(day(14), 27.1), point(day(15), null), point(day(16), 23.4)],
  irrigationEvents: [],
};

const row = {
  timestamp: day(14), moisture: 25, moistureForecast: null, etcMm: 4, effectiveRainMm: 0, irrigationMm: 0,
  isForecast: false, events: [],
};

test('history/forecast split and join point', () => {
  const rows = buildChartRows(fixture7d);
  assert.deepEqual(rows.map((r) => r.moisture), [27.1, 25.0, 23.4, null, null]);
  assert.deepEqual(rows.map((r) => r.moistureForecast), [null, null, 23.4, 22.0, null]);
});

test('null moisture stays null', () => {
  assert.equal(buildChartRows(fixtureWithGap)[1].moisture, null);
});

test('events attach to the bucket containing actualStart', () => {
  const rows = buildChartRows(fixture7d);
  assert.deepEqual(rows[1].events, [{ durationMinutes: 45, triggerType: 'AUTOMATED_DEFICIT' }]);
  assert.deepEqual(rows[0].events, []);
});

test('hourly buckets use one-hour windows and scheduledStart when not started', () => {
  const hourlyResponse = {
    ...fixture7d,
    window: '24h',
    resolution: 'hour',
    points: [point('2026-11-15T06:00:00Z', 25), point('2026-11-15T07:00:00Z', 24.8)],
    irrigationEvents: [{ ...fixture7d.irrigationEvents[0], actualStart: null, scheduledStart: '2026-11-15T07:30:00Z' }],
  };
  const rows = buildChartRows(hourlyResponse);
  assert.deepEqual(rows[0].events, []);
  assert.equal(rows[1].events.length, 1);
});

test('soil bands', () => {
  assert.deepEqual(
    soilBands({ fieldCapacityPct: 32, wiltingPointPct: 12, saturationPct: 45, madFraction: 0.5 }),
    { saturationPct: 45, fieldCapacityPct: 32, madThresholdPct: 22 },
  );
  assert.equal(soilBands(null), null);
});

test('axis domains default and expand', () => {
  assert.deepEqual(computeAxisDomains(buildChartRows(fixture7d), 43), { left: [0, 50], right: [0, 40] });
  assert.deepEqual(computeAxisDomains([{ ...row, effectiveRainMm: 30, irrigationMm: 20 }], 52), { left: [0, 57], right: [0, 60] });
  assert.deepEqual(computeAxisDomains([row], null), { left: [0, 50], right: [0, 40] });
});

test('day labels are UTC dates', () => {
  assert.equal(formatBucketLabel('2026-11-15T00:00:00Z', 'day'), 'Nov 15');
  assert.equal(formatBucketLabel('2026-11-15T14:00:00Z', 'hour', 'UTC'), '14:00');
});

test('tooltip lines', () => {
  const lines = tooltipLines({
    ...row, moisture: 21.5, etcMm: 4.8, effectiveRainMm: 3, irrigationMm: 12,
    events: [{ durationMinutes: 45, triggerType: 'AUTOMATED_DEFICIT' }],
  }, 22);
  for (const expected of ['Soil moisture 21.5 %', 'ETc 4.8 mm', 'Effective rain 3.0 mm', 'Irrigation 12.0 mm',
    'Valve opened: 45 min (Automatic)', 'Below MAD threshold']) {
    assert.ok(lines.includes(expected), expected);
  }
  assert.ok(tooltipLines({ ...row, isForecast: true, moistureForecast: 22.0 }, 22).includes('Forecast'));
  assert.ok(tooltipLines({ ...row, events: [{ durationMinutes: 30, triggerType: 'MANUAL_OVERRIDE' }] }, 22)
    .includes('Valve opened: 30 min (Manual)'));
  assert.ok(!tooltipLines({ ...row, etcMm: null }, 22).some((l) => l.startsWith('ETc')));
  assert.ok(!tooltipLines({ ...row, moisture: 10 }, null).includes('Below MAD threshold'));
});

test('aria label and hidden summary', () => {
  assert.equal(
    chartAriaLabel(buildChartRows(fixture7d), '7d', 22),
    'Soil moisture 7-day chart, latest 23.4 %, MAD threshold 22.0 %',
  );
  assert.equal(chartAriaLabel([], '24h', null), 'Soil moisture 24-hour chart, no readings');
  assert.ok(latestValuesSummary(buildChartRows(fixture7d)).startsWith('Latest reading: soil moisture 23.4 %'));
});

console.log(`\n${tests - failures}/${tests} telemetry chart model tests passed`);
if (failures > 0) process.exitCode = 1;
