/**
 * The landing background video is 14.8 MB. Download it automatically only on wide
 * screens for visitors who allow motion and have not asked to save data; everyone else
 * gets the static gradient and can still start it with the "Play Ambient Video" button.
 */
export function shouldAutoLoadBackgroundVideo(context: {
  reducedMotion: boolean;
  narrowScreen: boolean;
  saveData: boolean;
}): boolean {
  return !context.reducedMotion && !context.narrowScreen && !context.saveData;
}

/** Reads the browser preferences the policy needs; false everywhere outside a browser. */
export function detectBackgroundVideoAutoLoad(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return shouldAutoLoadBackgroundVideo({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    narrowScreen: window.matchMedia('(max-width: 639px)').matches,
    saveData: Boolean(connection?.saveData),
  });
}
