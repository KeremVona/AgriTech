import { resolveIrrigationConfig } from '../../utils/irrigationConfig.ts';

/** Environment-resolved configuration; components default to it when no `config` prop is given. */
export const DEFAULT_IRRIGATION_CONFIG = resolveIrrigationConfig({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_IRRIGATION_DATA_MODE: import.meta.env.VITE_IRRIGATION_DATA_MODE,
  VITE_IRRIGATION_POLL_MS: import.meta.env.VITE_IRRIGATION_POLL_MS,
});
