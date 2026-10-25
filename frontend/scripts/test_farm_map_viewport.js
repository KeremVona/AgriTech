import assert from 'node:assert/strict';
import { shouldFitParcels, getFitOptions, formatCoordinates, getScale } from '../src/components/FarmMap/farmMapPolicy.ts';

const bounds = [[38, 27], [39, 28]];
assert.equal(shouldFitParcels(null, null, 0), false);
assert.equal(shouldFitParcels(bounds, null, 0), true);
const previous = { bounds, request: 0 };
assert.equal(shouldFitParcels(structuredClone(bounds), previous, 0), false, 'identical extent preserves user pan');
assert.equal(shouldFitParcels(bounds, previous, 1), true, 'explicit fit frames unchanged parcels');
assert.equal(shouldFitParcels([[38, 27], [40, 28]], previous, 0), true);
assert.equal(shouldFitParcels(null, previous, 1), false);

assert.deepEqual(getFitOptions(1200, 700, 0, false), {
  paddingTopLeft: [48, 48], paddingBottomRight: [48, 48], maxZoom: 18, animate: true, duration: 0.8,
});
const mobile = getFitOptions(390, 700, 34, false);
assert.ok(mobile.paddingBottomRight[1] >= 112 + 34 + 144, 'frame clears attribution, safe area and navigation dock');
assert.ok(mobile.paddingBottomRight[0] >= 48);
assert.equal(getFitOptions(390, 700, 0, true).animate, false);
const landscape = getFitOptions(700, 250, 0, false);
assert.ok(landscape.paddingTopLeft[1] + landscape.paddingBottomRight[1] < 250);

assert.equal(formatCoordinates(38.42371, 27.14282), '38.42371° N, 27.14282° E');
assert.equal(formatCoordinates(-12, -27), '12.00000° S, 27.00000° W');
assert.equal(formatCoordinates(0, 387), '0.00000° N, 27.00000° E');
assert.equal(formatCoordinates(-0, -180), '0.00000° N, 180.00000° W');
assert.deepEqual(getScale(120, false), { label: '100 m', width: 75 });
assert.deepEqual(getScale(1200, false), { label: '1 km', width: 75 });
const feet = getScale(100, true);
assert.equal(feet.label, '300 ft');
assert.ok(feet.width <= 90 && feet.width > 0);
assert.equal(getScale(2000, true).label, '1 mi');
assert.equal(getScale(0, false), null);
assert.equal(getScale(Infinity, true), null);
console.log('PASS farm map framing, coordinate and scale policies');
