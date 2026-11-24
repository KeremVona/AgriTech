import assert from 'node:assert/strict';
import {
  SAMPLE_SOILS,
  createSampleTelemetry,
  createSampleValveSimulator,
  createSampleWaterBudget,
} from '../src/services/irrigationSampleData.ts';
import { ACTIVE_RUN_MESSAGE } from '../src/models/valveControlModel.ts';

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

const NOW = Date.parse('2026-11-20T11:30:00Z');
const DEMO_WEST = '20700000-0000-4000-8000-000000000001';
const sandyLoam = SAMPLE_SOILS.sandy_loam;

test('soil table mirrors the DB seed in percent', () => {
  assert.deepEqual(SAMPLE_SOILS.sand, { name: 'Sand', fieldCapacityPct: 12, wiltingPointPct: 5, saturationPct: 38, madFraction: 0.5 });
  assert.deepEqual(SAMPLE_SOILS.sandy_loam, { name: 'Sandy Loam', fieldCapacityPct: 22, wiltingPointPct: 10, saturationPct: 43, madFraction: 0.5 });
  assert.deepEqual(SAMPLE_SOILS.silt, { name: 'Silt', fieldCapacityPct: 31, wiltingPointPct: 14, saturationPct: 48, madFraction: 0.5 });
  assert.deepEqual(SAMPLE_SOILS.clay, { name: 'Clay', fieldCapacityPct: 38, wiltingPointPct: 22, saturationPct: 50, madFraction: 0.5 });
});

test('same inputs give identical output', () => {
  assert.deepEqual(createSampleTelemetry('p-1', '30d', NOW), createSampleTelemetry('p-1', '30d', NOW));
  assert.deepEqual(createSampleWaterBudget('p-1', NOW), createSampleWaterBudget('p-1', NOW));
});

test('different parcels give different series', () => {
  const a = createSampleTelemetry('p-1', '30d', NOW).points.map((p) => p.soilMoisturePct);
  const b = createSampleTelemetry('p-2', '30d', NOW).points.map((p) => p.soilMoisturePct);
  assert.notDeepEqual(a, b);
});

test('history is stable within a UTC day', () => {
  const early = createSampleTelemetry('p-1', '24h', Date.parse('2026-11-20T08:30:00Z')).points;
  const later = createSampleTelemetry('p-1', '24h', NOW).points;
  const laterByTime = new Map(later.map((p) => [p.timestamp, p.soilMoisturePct]));
  const shared = early.filter((p) => laterByTime.has(p.timestamp));
  assert.ok(shared.length >= 20, `shared ${shared.length}`);
  for (const p of shared) assert.equal(laterByTime.get(p.timestamp), p.soilMoisturePct, p.timestamp);
});

test('moisture stays within wilting point and saturation', () => {
  for (const id of ['p-1', 'p-2', 'p-3', DEMO_WEST]) {
    for (const p of createSampleTelemetry(id, '30d', NOW).points) {
      if (p.soilMoisturePct === null) continue;
      assert.ok(p.soilMoisturePct >= sandyLoam.wiltingPointPct && p.soilMoisturePct <= sandyLoam.saturationPct, `${id} ${p.soilMoisturePct}`);
    }
  }
});

test('24h window is hourly history only', () => {
  const t = createSampleTelemetry('p-1', '24h', NOW);
  assert.equal(t.resolution, 'hour');
  assert.equal(t.window, '24h');
  assert.equal(t.points.length, 24);
  assert.ok(t.points.every((p) => !p.isForecast && typeof p.etcMm === 'number'));
  assert.equal(t.points.at(-1).timestamp, '2026-11-20T11:00:00.000Z');
  assert.deepEqual(t.soil, { fieldCapacityPct: 22, wiltingPointPct: 10, saturationPct: 43, madFraction: 0.5 });
});

test('7d and 30d windows are daily with a 7-day forecast', () => {
  const week = createSampleTelemetry('p-1', '7d', NOW);
  assert.equal(week.resolution, 'day');
  assert.equal(week.points.filter((p) => !p.isForecast).length, 7);
  assert.equal(week.points.filter((p) => p.isForecast).length, 7);
  assert.equal(week.points[6].timestamp, '2026-11-20T00:00:00.000Z');
  const month = createSampleTelemetry('p-1', '30d', NOW);
  assert.equal(month.points.filter((p) => !p.isForecast).length, 30);
  assert.equal(month.points.filter((p) => p.isForecast).length, 7);
  assert.ok(month.irrigationEvents.some((e) => e.triggerType === 'AUTOMATED_DEFICIT' && e.status === 'COMPLETED' && e.durationMinutes === 45));
});

test('night hours stay flat without rain or irrigation', () => {
  const points = createSampleTelemetry('p-1', '24h', NOW).points;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const hour = new Date(prev.timestamp).getUTCHours();
    if (hour > 5 || prev.effectiveRainMm > 0 || prev.irrigationMm > 0) continue;
    assert.ok(Math.abs(points[i].soilMoisturePct - prev.soilMoisturePct) < 0.05, prev.timestamp);
  }
});

test('budget agrees with the latest hourly and daily readings', () => {
  const budget = createSampleWaterBudget('p-1', NOW);
  const hourly = createSampleTelemetry('p-1', '24h', NOW).points;
  const daily = createSampleTelemetry('p-1', '7d', NOW).points.filter((p) => !p.isForecast);
  assert.equal(budget.currentMoisturePct, hourly.at(-1).soilMoisturePct);
  assert.equal(budget.currentMoisturePct, daily.at(-1).soilMoisturePct);
  assert.equal(budget.latestReadingAt, '2026-11-20T11:00:00.000Z');
  assert.equal(budget.hoursUntilTrigger, null);
  assert.equal(budget.systemFlowRateLpm, 100);
});

test('hints select soil, name and crop', () => {
  const clay = createSampleWaterBudget('p-1', NOW, { soilProfileId: 'clay', parcelName: 'North', cropName: 'Tomato' });
  assert.equal(clay.fieldCapacityPct, 38);
  assert.equal(clay.soilProfileId, 'clay');
  assert.equal(clay.parcelName, 'North');
  assert.equal(clay.cropName, 'Tomato');
  assert.equal(createSampleTelemetry('p-1', '24h', NOW, { soilProfileId: 'clay' }).soil.fieldCapacityPct, 38);
});

test('defaults for unknown parcels and the demo parcel name', () => {
  const unknown = createSampleWaterBudget('p-unknown', NOW);
  assert.equal(unknown.fieldCapacityPct, 22);
  assert.equal(unknown.soilProfileName, 'Sandy Loam (sample default)');
  assert.equal(unknown.parcelName, 'Sample parcel');
  assert.equal(createSampleWaterBudget(DEMO_WEST, NOW).parcelName, 'Demo west parcel');
});

test('simulator runs Opening → Pumping → Closed', () => {
  const sim = createSampleValveSimulator();
  assert.equal(sim.getStatus('p-1', NOW).valveState, 'CLOSED');
  const evt = sim.startManual('p-1', 15, NOW);
  assert.equal(evt.status, 'IN_PROGRESS');
  assert.equal(evt.triggerType, 'MANUAL_OVERRIDE');
  assert.equal(evt.durationMinutes, 15);
  assert.equal(sim.getStatus('p-1', NOW + 1000).valveState, 'OPENING');
  const pumping = sim.getStatus('p-1', NOW + 5000);
  assert.equal(pumping.valveState, 'PUMPING');
  assert.equal(pumping.activeEvent.id, evt.id);
  assert.equal(pumping.serverTime, new Date(NOW + 5000).toISOString());
  assert.throws(() => sim.startManual('p-1', 30, NOW + 6000), { message: ACTIVE_RUN_MESSAGE });
  const done = sim.getStatus('p-1', NOW + 15 * 60_000 + 1);
  assert.equal(done.valveState, 'CLOSED');
  assert.equal(done.activeEvent, null);
  assert.equal(done.lastEvent.status, 'COMPLETED');
  assert.equal(sim.getStatus('p-2', NOW).valveState, 'CLOSED');
});

test('simulator abort closes the valve', () => {
  const sim = createSampleValveSimulator();
  const evt = sim.startManual('p-1', 30, NOW);
  const aborted = sim.abort('p-1', evt.id, NOW + 60_000);
  assert.equal(aborted.status, 'ABORTED');
  const after = sim.getStatus('p-1', NOW + 61_000);
  assert.equal(after.valveState, 'CLOSED');
  assert.equal(after.lastEvent.id, evt.id);
  assert.throws(() => sim.abort('p-1', evt.id, NOW + 62_000));
});

console.log(`\n${tests - failures}/${tests} irrigation sample data tests passed`);
if (failures > 0) process.exitCode = 1;
