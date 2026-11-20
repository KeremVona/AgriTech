import assert from 'node:assert/strict';
import { combineSources, controlsEnabled, resolveIrrigationConfig } from '../src/utils/irrigationConfig.ts';
import {
  IrrigationRequestError,
  abortIrrigation,
  fetchIrrigationStatus,
  fetchTelemetry,
  fetchWaterBudget,
  parseTelemetry,
  parseWaterBudget,
  sampleValveSimulator,
  startManualIrrigation,
} from '../src/services/irrigationService.ts';

let failures = 0;
let tests = 0;

async function test(name, run) {
  tests++;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const NOW = Date.parse('2026-11-20T11:30:00Z');
const autoConfig = { apiBaseUrl: 'http://localhost:5051', mode: 'auto', pollMs: 15000 };
const apiConfig = { ...autoConfig, mode: 'api' };
const sampleConfig = { ...autoConfig, mode: 'sample' };

const budgetBody = {
  parcelId: 'p-1', parcelName: 'North Block', cropName: 'Tomato', soilProfileId: 'silt', soilProfileName: 'Silt',
  fieldCapacityPct: 31, wiltingPointPct: 14, saturationPct: 48, madFraction: 0.5,
  currentMoisturePct: 24.3, latestReadingAt: '2026-11-20T11:00:00Z', hoursUntilTrigger: 18.5, systemFlowRateLpm: 100,
};
const eventBody = {
  id: 'evt-1', triggerType: 'MANUAL_OVERRIDE', status: 'IN_PROGRESS', scheduledStart: '2026-11-20T11:30:00Z',
  actualStart: '2026-11-20T11:30:00Z', completedAt: null, durationMinutes: 30, waterVolumeLiters: 3000,
};

function recorder(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, fetchImpl };
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const never = () => new Promise(() => {});

await test('config defaults', () => {
  assert.deepEqual(resolveIrrigationConfig({}), { config: { apiBaseUrl: 'http://localhost:5051', mode: 'auto', pollMs: 15000 }, error: null });
});
await test('config poll clamps and defaults', () => {
  assert.equal(resolveIrrigationConfig({ VITE_IRRIGATION_POLL_MS: '1000' }).config.pollMs, 5000);
  assert.equal(resolveIrrigationConfig({ VITE_IRRIGATION_POLL_MS: 'abc' }).config.pollMs, 15000);
  assert.equal(resolveIrrigationConfig({ VITE_IRRIGATION_POLL_MS: '20000' }).config.pollMs, 20000);
});
await test('config rejects bad mode and URL', () => {
  assert.equal(resolveIrrigationConfig({ VITE_IRRIGATION_DATA_MODE: 'bogus' }).config, null);
  assert.match(resolveIrrigationConfig({ VITE_IRRIGATION_DATA_MODE: 'bogus' }).error, /VITE_IRRIGATION_DATA_MODE/);
  assert.equal(resolveIrrigationConfig({ VITE_API_BASE_URL: 'ftp://x' }).config, null);
});

await test('combineSources labels', () => {
  const api = { data: 1, source: 'api', fallbackReason: null };
  const fallback = { data: 1, source: 'sample', fallbackReason: 'HTTP 404' };
  const sample = { data: 1, source: 'sample', fallbackReason: null };
  assert.deepEqual(combineSources([api, api], 'auto'), { label: 'Live data', anySample: false });
  assert.deepEqual(combineSources([fallback, fallback], 'auto'), { label: 'Sample data — live data unavailable', anySample: true });
  assert.deepEqual(combineSources([sample, null], 'sample'), { label: 'Sample data', anySample: true });
  assert.deepEqual(combineSources([api, fallback], 'auto'), { label: 'Partly sample data — some live data unavailable', anySample: true });
  assert.deepEqual(combineSources([null, null], 'auto'), { label: 'Loading…', anySample: false });
});

await test('controlsEnabled', () => {
  assert.equal(controlsEnabled('sample', 'auto'), false);
  assert.equal(controlsEnabled('api', 'auto'), true);
  assert.equal(controlsEnabled('sample', 'sample'), true);
  assert.equal(controlsEnabled(null, 'api'), false);
});

await test('live budget is parsed and URL encodes the parcel id', async () => {
  const { calls, fetchImpl } = recorder(() => json(200, budgetBody));
  const result = await fetchWaterBudget({ config: apiConfig, parcelId: 'a/b', fetchImpl });
  assert.equal(result.source, 'api');
  assert.equal(result.fallbackReason, null);
  assert.equal(result.data.currentMoisturePct, 24.3);
  assert.equal(calls[0].url, 'http://localhost:5051/api/v1/parcels/a%2Fb/water-budget');
});

await test('auto + 404 falls back to sample', async () => {
  const { fetchImpl } = recorder(() => json(404, {}));
  const result = await fetchWaterBudget({ config: autoConfig, parcelId: 'p-1', fetchImpl, nowMs: NOW });
  assert.equal(result.source, 'sample');
  assert.match(result.fallbackReason, /HTTP 404/);
  assert.equal(typeof result.data.currentMoisturePct, 'number');
});

await test('auto + network failure falls back to sample', async () => {
  const { fetchImpl } = recorder(() => { throw new TypeError('fetch failed'); });
  const result = await fetchTelemetry({ config: autoConfig, parcelId: 'p-1', window: '7d', fetchImpl, nowMs: NOW });
  assert.equal(result.source, 'sample');
  assert.equal(result.data.window, '7d');
});

await test('auto + timeout falls back to sample', async () => {
  const { fetchImpl } = recorder(never);
  const result = await fetchIrrigationStatus({ config: autoConfig, parcelId: 'p-1', fetchImpl, nowMs: NOW, timeoutMs: 20 });
  assert.equal(result.source, 'sample');
  assert.match(result.fallbackReason, /timed out/);
});

await test('api mode never falls back', async () => {
  await assert.rejects(fetchWaterBudget({ config: apiConfig, parcelId: 'p-1', fetchImpl: recorder(() => json(404, {})).fetchImpl }), /HTTP 404/);
  await assert.rejects(fetchWaterBudget({ config: apiConfig, parcelId: 'p-1', fetchImpl: recorder(() => json(500, {})).fetchImpl }), /HTTP 500/);
});

await test('409 is a user error even in auto mode', async () => {
  const { fetchImpl } = recorder(() => json(409, { detail: 'A run is already active.' }));
  await assert.rejects(fetchWaterBudget({ config: autoConfig, parcelId: 'p-1', fetchImpl }), (error) => {
    assert.ok(error instanceof IrrigationRequestError);
    assert.equal(error.status, 409);
    assert.equal(error.message, 'A run is already active.');
    return true;
  });
});

await test('malformed body is a hard error', async () => {
  const { fetchImpl } = recorder(() => json(200, {}));
  await assert.rejects(fetchWaterBudget({ config: autoConfig, parcelId: 'p-1', fetchImpl }), { message: 'Malformed water budget response.' });
});

await test('parseWaterBudget normalizes only soil constants', () => {
  const parsed = parseWaterBudget({ ...budgetBody, fieldCapacityPct: 0.22, wiltingPointPct: 0.1, saturationPct: 0.43, currentMoisturePct: 0.8 });
  assert.equal(parsed.fieldCapacityPct, 22);
  assert.equal(parsed.wiltingPointPct, 10);
  assert.equal(parsed.saturationPct, 43);
  assert.equal(parsed.currentMoisturePct, 0.8);
  const noSoil = parseWaterBudget({ ...budgetBody, soilProfileId: null, soilProfileName: null, fieldCapacityPct: null, wiltingPointPct: null, saturationPct: null, madFraction: null });
  assert.equal(noSoil.fieldCapacityPct, null);
  assert.equal(noSoil.madFraction, null);
});

await test('parseTelemetry normalizes soil and accepts null soil', () => {
  const body = {
    parcelId: 'p-1', window: '24h', resolution: 'hour',
    soil: { fieldCapacityPct: 0.32, wiltingPointPct: 0.12, saturationPct: 0.45, madFraction: 0.5 },
    points: [{ timestamp: '2026-11-20T10:00:00Z', soilMoisturePct: 24.3, etcMm: null, effectiveRainMm: 0, irrigationMm: 0, isForecast: false }],
    irrigationEvents: [],
  };
  assert.equal(parseTelemetry(body).soil.fieldCapacityPct, 32);
  assert.equal(parseTelemetry({ ...body, soil: null }).soil, null);
  assert.throws(() => parseTelemetry({ ...body, points: [{ timestamp: 5 }] }), { message: 'Malformed telemetry response.' });
});

await test('sample mode makes no request', async () => {
  const { calls, fetchImpl } = recorder(() => json(200, budgetBody));
  const budget = await fetchWaterBudget({ config: sampleConfig, parcelId: 'p-1', fetchImpl, nowMs: NOW });
  const status = await fetchIrrigationStatus({ config: sampleConfig, parcelId: 'p-1', fetchImpl, nowMs: NOW });
  assert.equal(calls.length, 0);
  assert.equal(budget.source, 'sample');
  assert.equal(budget.fallbackReason, null);
  assert.equal(status.data.valveState, 'CLOSED');
});

await test('startManualIrrigation never falls back in auto mode', async () => {
  const { fetchImpl } = recorder(() => json(503, {}));
  await assert.rejects(startManualIrrigation({ config: autoConfig, parcelId: 'p-auto', durationMinutes: 30, fetchImpl, nowMs: NOW }), /HTTP 503/);
  assert.equal(sampleValveSimulator.getStatus('p-auto', NOW).valveState, 'CLOSED');
});

await test('manual start POSTs the duration', async () => {
  const { calls, fetchImpl } = recorder(() => json(202, eventBody));
  const evt = await startManualIrrigation({ config: apiConfig, parcelId: 'p-1', durationMinutes: 30, fetchImpl });
  assert.equal(evt.id, 'evt-1');
  assert.equal(calls[0].url, 'http://localhost:5051/api/v1/parcels/p-1/irrigate-manual');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, '{"durationMinutes":30}');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
});

await test('abort POSTs to the event URL', async () => {
  const { calls, fetchImpl } = recorder(() => json(200, { ...eventBody, status: 'ABORTED' }));
  const evt = await abortIrrigation({ config: apiConfig, parcelId: 'p-1', eventId: 'e/1', fetchImpl });
  assert.equal(evt.status, 'ABORTED');
  assert.equal(calls[0].url, 'http://localhost:5051/api/v1/parcels/p-1/irrigation/e%2F1/abort');
});

await test('telemetry URL carries the window', async () => {
  const { calls, fetchImpl } = recorder(() => json(404, {}));
  await fetchTelemetry({ config: autoConfig, parcelId: 'p-1', window: '7d', fetchImpl, nowMs: NOW });
  assert.ok(calls[0].url.endsWith('/telemetry?window=7d'), calls[0].url);
});

await test('sample-mode writes drive the shared simulator', async () => {
  const evt = await startManualIrrigation({ config: sampleConfig, parcelId: 'p-sim', durationMinutes: 15, nowMs: NOW });
  const status = await fetchIrrigationStatus({ config: sampleConfig, parcelId: 'p-sim', nowMs: NOW + 5000 });
  assert.equal(status.data.valveState, 'PUMPING');
  const aborted = await abortIrrigation({ config: sampleConfig, parcelId: 'p-sim', eventId: evt.id, nowMs: NOW + 6000 });
  assert.equal(aborted.status, 'ABORTED');
});

await test('caller abort rejects with AbortError', async () => {
  const controller = new AbortController();
  const { fetchImpl } = recorder(never);
  const pending = fetchWaterBudget({ config: autoConfig, parcelId: 'p-1', fetchImpl, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError');
});

console.log(`\n${tests - failures}/${tests} irrigation service tests passed`);
if (failures > 0) process.exitCode = 1;
