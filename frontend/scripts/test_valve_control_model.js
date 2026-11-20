import assert from 'node:assert/strict';
import {
  ACTIVE_RUN_MESSAGE,
  CONTROLS_UNAVAILABLE_MESSAGE,
  DEFAULT_MANUAL_DURATION,
  MANUAL_DURATIONS,
  deriveValveDisplay,
  estimateVolumeLiters,
  formatCountdown,
  formatStartsIn,
  initialValveControlState,
  statusIsStale,
  stopConfirmVisible,
  stoppableEventId,
  upcomingRunLabel,
  valveControlReducer,
} from '../src/models/valveControlModel.ts';

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

const T0 = Date.parse('2026-11-20T10:00:00Z');
const SERVER_NOW = Date.parse('2026-11-20T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

const event = (overrides = {}) => ({
  id: 'evt-1', triggerType: 'AUTOMATED_DEFICIT', status: 'IN_PROGRESS',
  scheduledStart: iso(T0 - 10 * 60_000), actualStart: iso(T0 - 10 * 60_000), completedAt: null,
  durationMinutes: 45, waterVolumeLiters: 4500, ...overrides,
});
const status = (overrides = {}) => ({
  valveState: 'CLOSED', flowRateLpm: 100, activeEvent: null, nextScheduledEvent: null, lastEvent: null,
  serverTime: iso(T0), ...overrides,
});

const closedStatus = status();
const pumpingStatus = status({ valveState: 'PUMPING', activeEvent: event() });
const closedWithNextAutomatedIn2h = status({
  nextScheduledEvent: event({ id: 'evt-next', status: 'PENDING', scheduledStart: iso(T0 + 7200_000), actualStart: null }),
});
const activePendingManual = ({ scheduledStartMs }) => status({
  activeEvent: event({ id: 'evt-man', triggerType: 'MANUAL_OVERRIDE', status: 'PENDING', scheduledStart: iso(scheduledStartMs), actualStart: null }),
});
const inProgressManual = (startMs, minutes) => event({
  id: 'evt-man', triggerType: 'MANUAL_OVERRIDE', status: 'IN_PROGRESS', scheduledStart: iso(startMs), actualStart: iso(startMs), durationMinutes: minutes,
});
const pumpingStartedAt = (startMs) => status({
  valveState: 'PUMPING', serverTime: iso(SERVER_NOW), activeEvent: event({ scheduledStart: iso(startMs), actualStart: iso(startMs) }),
});
const withServer = (server) => ({ ...initialValveControlState, server, clockOffsetMs: 0 });

test('constants', () => {
  assert.deepEqual([...MANUAL_DURATIONS], [15, 30, 45, 60]);
  assert.equal(DEFAULT_MANUAL_DURATION, 30);
});

test('optimistic start shows Opening with countdown', () => {
  const s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  const d = deriveValveDisplay(s, T0 + 60_000, true);
  assert.equal(d.label, 'Opening');
  assert.equal(d.tone, 'transition');
  assert.equal(d.secondsLeft, 29 * 60);
  assert.equal(d.canStart, false);
});

test('poll during pending start keeps optimistic state', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'poll-received', status: closedStatus, requestStartedAtMs: T0 + 500, receivedAtMs: T0 + 1000 });
  assert.equal(deriveValveDisplay(s, T0 + 1000, true).label, 'Opening');
});

test('start success shows Opening immediately', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-succeeded', event: inProgressManual(T0, 30), nowMs: T0 + 300 });
  const d = deriveValveDisplay(s, T0 + 300, true);
  assert.equal(d.label, 'Opening');
  assert.ok(d.secondsLeft > 0);
  assert.equal(s.pending, null);
});

test('start success with a PENDING manual event lands in activeEvent and keeps the automated schedule', () => {
  let s = valveControlReducer(withServer(closedWithNextAutomatedIn2h), { type: 'start-requested', durationMinutes: 15, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-succeeded', event: event({ id: 'evt-p', triggerType: 'MANUAL_OVERRIDE', status: 'PENDING', actualStart: null, scheduledStart: iso(T0 + 60_000) }), nowMs: T0 });
  assert.equal(s.server.activeEvent.id, 'evt-p');
  assert.equal(s.server.nextScheduledEvent.id, 'evt-next');
  assert.equal(s.server.valveState, 'CLOSED');
});

test('upcoming run label comes from the trigger type', () => {
  assert.equal(upcomingRunLabel(event({ triggerType: 'MANUAL_OVERRIDE' })), 'Manual run');
  assert.equal(upcomingRunLabel(event({ triggerType: 'AUTOMATED_DEFICIT' })), 'Next automatic run');
  assert.equal(upcomingRunLabel(event({ triggerType: 'SCHEDULED_RECIPE' })), 'Next scheduled run');
});

test('status goes stale after two missed polls', () => {
  assert.equal(statusIsStale(null, T0, 15_000), true);
  assert.equal(statusIsStale(T0, T0 + 30_000, 15_000), false);
  assert.equal(statusIsStale(T0, T0 + 30_001, 15_000), true);
  const s = valveControlReducer(initialValveControlState, { type: 'poll-received', status: closedStatus, requestStartedAtMs: T0 - 50, receivedAtMs: T0 });
  assert.equal(s.lastPollReceivedAtMs, T0);
});

test('stop confirmation only applies to the run it was opened for', () => {
  const s = withServer(pumpingStatus);
  assert.equal(stopConfirmVisible(s, pumpingStatus.activeEvent.id, true), true);
  assert.equal(stopConfirmVisible(s, 'old-run', true), false);
  assert.equal(stopConfirmVisible(s, null, true), false);
  assert.equal(stopConfirmVisible(s, pumpingStatus.activeEvent.id, false), false);
});

test('poll sent before write settled is discarded', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-succeeded', event: inProgressManual(T0, 30), nowMs: T0 + 300 });
  const after = valveControlReducer(s, { type: 'poll-received', status: closedStatus, requestStartedAtMs: T0 - 100, receivedAtMs: T0 + 400 });
  assert.equal(after, s);
});

test('poll sent after write settled is applied', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-succeeded', event: inProgressManual(T0, 30), nowMs: T0 + 300 });
  s = valveControlReducer(s, { type: 'poll-received', status: pumpingStatus, requestStartedAtMs: T0 + 500, receivedAtMs: T0 + 600 });
  assert.equal(deriveValveDisplay(s, T0 + 600, true).label, 'Pumping');
});

test('double submit, missing server and invalid duration are ignored', () => {
  const s1 = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  assert.equal(valveControlReducer(s1, { type: 'start-requested', durationMinutes: 60, nowMs: T0 }), s1);
  assert.equal(valveControlReducer(initialValveControlState, { type: 'start-requested', durationMinutes: 30, nowMs: T0 }), initialValveControlState);
  const s = withServer(closedStatus);
  assert.equal(valveControlReducer(s, { type: 'start-requested', durationMinutes: 20, nowMs: T0 }), s);
  const busy = withServer(pumpingStatus);
  assert.equal(valveControlReducer(busy, { type: 'start-requested', durationMinutes: 30, nowMs: T0 }), busy);
});

test('start failure rolls back and reports', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-failed', message: 'HTTP 503', nowMs: T0 + 200 });
  assert.equal(deriveValveDisplay(s, T0, true).label, 'Closed');
  assert.equal(s.error, 'HTTP 503');
  assert.equal(valveControlReducer(s, { type: 'dismiss-error' }).error, null);
});

test('in-progress run blocks start and allows stop; pending automated run does not block', () => {
  const d = deriveValveDisplay(withServer(pumpingStatus), T0, true);
  assert.equal(d.label, 'Pumping');
  assert.equal(d.tone, 'active');
  assert.equal(d.flowRateLpm, 100);
  assert.equal(d.canStart, false);
  assert.equal(d.canStop, true);
  assert.equal(d.startBlockedReason, ACTIVE_RUN_MESSAGE);
  const p = deriveValveDisplay(withServer(closedWithNextAutomatedIn2h), T0, true);
  assert.equal(p.canStart, true);
  assert.equal(p.startBlockedReason, null);
  assert.equal(p.startsInSeconds, 7200);
});

test('controls locked when status is not live', () => {
  const d = deriveValveDisplay(withServer(pumpingStatus), T0, false);
  assert.equal(d.canStart, false);
  assert.equal(d.canStop, false);
  assert.equal(d.startBlockedReason, CONTROLS_UNAVAILABLE_MESSAGE);
});

test('pending manual run without actualStart', () => {
  const d = deriveValveDisplay(withServer(activePendingManual({ scheduledStartMs: T0 + 90_000 })), T0, true);
  assert.equal(d.secondsLeft, null);
  assert.equal(d.startsInSeconds, 90);
  assert.equal(d.isStarting, false);
  assert.equal(d.canStart, false, 'own pending manual run blocks a second Water now');
  assert.equal(d.startBlockedReason, ACTIVE_RUN_MESSAGE);
  assert.equal(deriveValveDisplay(withServer(activePendingManual({ scheduledStartMs: T0 - 5_000 })), T0, true).isStarting, true);
  const busy = withServer(activePendingManual({ scheduledStartMs: T0 + 90_000 }));
  assert.equal(valveControlReducer(busy, { type: 'start-requested', durationMinutes: 30, nowMs: T0 }), busy);
});

test('countdown uses server clock offset and clamps at zero', () => {
  const s = valveControlReducer(initialValveControlState, {
    type: 'poll-received', status: pumpingStartedAt(SERVER_NOW - 44 * 60_000),
    requestStartedAtMs: SERVER_NOW - 120_100, receivedAtMs: SERVER_NOW - 120_000,
  });
  assert.equal(s.clockOffsetMs, 120_000);
  const d = deriveValveDisplay(s, SERVER_NOW - 120_000, true);
  assert.equal(d.secondsLeft, 60);
  assert.equal(d.closesAtMs, SERVER_NOW - 120_000 + 60_000);
  assert.equal(deriveValveDisplay(s, SERVER_NOW + 3_600_000, true).secondsLeft, 0);
});

test('stop targets active event and closes valve on success', () => {
  let s = withServer(pumpingStatus);
  assert.equal(stoppableEventId(s), pumpingStatus.activeEvent.id);
  assert.equal(valveControlReducer(s, { type: 'stop-requested', eventId: 'other' }), s);
  s = valveControlReducer(s, { type: 'stop-requested', eventId: pumpingStatus.activeEvent.id });
  assert.equal(deriveValveDisplay(s, T0, true).label, 'Stopping');
  s = valveControlReducer(s, { type: 'stop-succeeded', event: { ...pumpingStatus.activeEvent, status: 'ABORTED' }, nowMs: T0 + 100 });
  assert.equal(deriveValveDisplay(s, T0 + 100, true).label, 'Closed');
  assert.equal(s.server.lastEvent.status, 'ABORTED');
  assert.equal(s.server.activeEvent, null);
});

test('stop falls back to the next scheduled event and failure rolls back', () => {
  let s = withServer(closedWithNextAutomatedIn2h);
  assert.equal(stoppableEventId(s), 'evt-next');
  assert.equal(stoppableEventId(withServer(closedStatus)), null);
  s = valveControlReducer(s, { type: 'stop-requested', eventId: 'evt-next' });
  s = valveControlReducer(s, { type: 'stop-failed', message: 'HTTP 409', nowMs: T0 });
  assert.equal(s.server.nextScheduledEvent.id, 'evt-next');
  assert.equal(s.error, 'HTTP 409');
});

test('formatters', () => {
  assert.equal(formatCountdown(59), '00:59');
  assert.equal(formatCountdown(3725), '1:02:05');
  assert.equal(formatStartsIn(7500), '2 h 05 min');
  assert.equal(formatStartsIn(300), '5 min');
  assert.equal(formatStartsIn(20), '<1 min');
  assert.equal(estimateVolumeLiters(30, 100), 3000);
});

console.log(`\n${tests - failures}/${tests} valve control model tests passed`);
if (failures > 0) process.exitCode = 1;
