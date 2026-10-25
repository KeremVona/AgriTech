export type MapBounds = [[number, number], [number, number]];
export type LastFit = { bounds: MapBounds; request: number };

export function shouldFitParcels(bounds: MapBounds | null, previous: LastFit | null, request: number): boolean {
  return bounds !== null && (previous === null || request !== previous.request
    || bounds.some((corner, index) => corner.some((value, axis) => value !== previous.bounds[index][axis])));
}

export function getFitOptions(width: number, height: number, safeBottom: number, reducedMotion: boolean) {
  const mobile = width < 1024;
  return {
    paddingTopLeft: (mobile ? [36, Math.min(76, height / 4)] : [48, 48]) as [number, number],
    paddingBottomRight: (mobile ? [84, Math.min(252 + safeBottom, height / 2)] : [48, 48]) as [number, number],
    maxZoom: 18, animate: !reducedMotion, duration: 0.8,
  };
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return `${Math.abs(latitude).toFixed(5)}° ${latitude < 0 ? 'S' : 'N'}, ${Math.abs(wrapped).toFixed(5)}° ${wrapped < 0 ? 'W' : 'E'}`;
}

/** A readable scale no wider than 90px, based on Leaflet's 1/2/3/5 scale intervals. */
export function getScale(maxMeters: number, imperial: boolean): { label: string; width: number } | null {
  if (!Number.isFinite(maxMeters) || maxMeters <= 0) return null;
  const feet = maxMeters / 0.3048;
  const largerUnit = imperial ? feet >= 5280 : maxMeters >= 1000;
  const units = imperial ? (largerUnit ? feet / 5280 : feet) : (largerUnit ? maxMeters / 1000 : maxMeters);
  const power = 10 ** Math.floor(Math.log10(units));
  const rounded = [1, 2, 3, 5, 10].filter((step) => step * power <= units).at(-1)! * power;
  const label = `${Number(rounded.toPrecision(3))} ${imperial ? (largerUnit ? 'mi' : 'ft') : (largerUnit ? 'km' : 'm')}`;
  return { label, width: 90 * rounded / units };
}
