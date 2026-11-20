import assert from 'node:assert/strict';
import {
  budgetSoil,
  computeDeficit,
  estimateTrigger,
  gaugeAngleDeg,
  gaugeAriaValueNow,
  isStale,
  normalizeSoilPercent,
  zoneTone,
} from '../src/models/waterBalanceModel.ts';

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

const base = { fieldCapacityPct: 32, wiltingPointPct: 12, saturationPct: 45, madFraction: 0.5 };
const budgetFixture = {
  parcelId: 'p-1',
  parcelName: 'North Block',
  cropName: 'Tomato',
  soilProfileId: 'silt',
  soilProfileName: 'Silt',
  ...base,
  currentMoisturePct: 24.3,
  latestReadingAt: '2026-11-20T10:00:00Z',
  hoursUntilTrigger: null,
  systemFlowRateLpm: 100,
};
const hourly = (values, startHour = 0) => values.map((v, i) => ({
  timestamp: new Date(Date.UTC(2026, 10, 19, startHour + i)).toISOString(),
  soilMoisturePct: v,
}));

test('computeDeficit core values', () => {
  const r = computeDeficit({ ...base, currentMoisturePct: 24.3 });
  assert.equal(r.tawPct, 20);
  assert.equal(r.rawPct, 10);
  assert.equal(r.madThresholdPct, 22);
  assert.ok(Math.abs(r.depletionPct - 7.7) < 1e-9);
  assert.ok(Math.abs(r.ratio - 0.77) < 1e-9);
  assert.equal(r.zone, 'irrigation-soon');
});

test('zone boundaries', () => {
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 27.1 }).zone, 'comfortable');
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 27 }).zone, 'watch');
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 24.5 }).zone, 'irrigation-soon');
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 22 }).zone, 'stress');
  assert.equal(zoneTone('watch'), 'yellow');
  assert.equal(zoneTone('irrigation-soon'), 'yellow');
  assert.equal(zoneTone('stress'), 'red');
  assert.equal(zoneTone('comfortable'), 'green');
});

test('clamps above FC and below WP', () => {
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 35 }).ratio, 0);
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 5 }).depletionPct, 20);
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 5 }).ratio, 2);
});

test('normalizeSoilPercent and budgetSoil', () => {
  assert.equal(normalizeSoilPercent(0.22), 22);
  assert.equal(normalizeSoilPercent(22), 22);
  assert.equal(budgetSoil({ ...budgetFixture, fieldCapacityPct: null }), null);
  assert.deepEqual(budgetSoil(budgetFixture), base);
});

test('estimateTrigger over a 24 h drying window', () => {
  const s = hourly(Array.from({ length: 24 }, (_, i) => 26.6 - 0.1 * i));
  const e = estimateTrigger({ samples: s, currentMoisturePct: 24.3, madThresholdPct: 22, apiHours: null });
  assert.equal(e.kind, 'hours');
  assert.ok(Math.abs(e.hours - 23) < 1e-6, `hours ${e.hours}`);
});

test('night-time flat hours alone do not read as not-drying', () => {
  const day = Array.from({ length: 12 }, (_, i) => 30 - 0.4 * i);
  const s = hourly([...day, ...Array(12).fill(day[11])]);
  assert.equal(estimateTrigger({ samples: s, currentMoisturePct: day[11], madThresholdPct: 22, apiHours: null }).kind, 'hours');
});

test('estimateTrigger order: reached, api, not-drying, unknown', () => {
  assert.deepEqual(estimateTrigger({ samples: [], currentMoisturePct: 21, madThresholdPct: 22, apiHours: 18.5 }), { kind: 'reached' });
  assert.deepEqual(estimateTrigger({ samples: [], currentMoisturePct: 25, madThresholdPct: 22, apiHours: 18.5 }), { kind: 'hours', hours: 18.5 });
  assert.deepEqual(estimateTrigger({ samples: hourly(Array(24).fill(25)), currentMoisturePct: 25, madThresholdPct: 22, apiHours: null }), { kind: 'not-drying' });
  assert.deepEqual(estimateTrigger({ samples: hourly([25, 24.9, 24.8]), currentMoisturePct: 24.8, madThresholdPct: 22, apiHours: null }), { kind: 'unknown' });
});

test('estimateTrigger ignores null samples and samples older than 24 h', () => {
  // 10 old drying samples (more than 24 h before the latest) then 6 recent flat ones → only 5 h span → unknown
  const old = hourly([30, 29, 28, 27, 26, 25, 24.9, 24.8, 24.7, 24.6]);
  const recent = hourly([24.5, null, 24.5, 24.5, 24.5, 24.5], 40);
  assert.deepEqual(estimateTrigger({ samples: [...old, ...recent], currentMoisturePct: 24.5, madThresholdPct: 22, apiHours: null }), { kind: 'unknown' });
});

test('isStale', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  assert.equal(isStale('2026-11-20T10:30:00Z', now), false);
  assert.equal(isStale('2026-11-20T09:59:00Z', now), true);
  assert.equal(isStale(null, now), true);
});

test('gauge angle and aria clamp', () => {
  assert.equal(gaugeAngleDeg(0), -120);
  assert.equal(gaugeAngleDeg(0.75), 0);
  assert.equal(gaugeAngleDeg(1.5), 120);
  assert.equal(gaugeAngleDeg(3), 120);
  assert.equal(gaugeAngleDeg(-1), -120);
  assert.equal(gaugeAriaValueNow(0.77), 77);
  assert.equal(gaugeAriaValueNow(2), 150);
});

console.log(`\n${tests - failures}/${tests} water-balance tests passed`);
if (failures > 0) process.exitCode = 1;
