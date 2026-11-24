/**
 * Phase 3 irrigation contract types (spec §6, docs/superpowers/specs/2026-11-20-phase3-irrigation-frontend-design.md).
 * All moisture values are percent volumetric water content (VWC %).
 */

export type IrrigationDataMode = 'auto' | 'api' | 'sample';
export type DataSource = 'api' | 'sample';
export type TelemetryWindow = '24h' | '7d' | '30d';

export interface SoilConstants {
  fieldCapacityPct: number;
  wiltingPointPct: number;
  saturationPct: number;
  madFraction: number;
}

export interface WaterBudget {
  parcelId: string;
  parcelName: string;
  cropName: string | null;
  soilProfileId: string | null;
  soilProfileName: string | null;
  fieldCapacityPct: number | null;
  wiltingPointPct: number | null;
  saturationPct: number | null;
  madFraction: number | null;
  currentMoisturePct: number | null;
  latestReadingAt: string | null;
  hoursUntilTrigger: number | null;
  systemFlowRateLpm: number;
}

export interface TelemetryPoint {
  timestamp: string;
  soilMoisturePct: number | null;
  etcMm: number | null;
  effectiveRainMm: number;
  irrigationMm: number;
  isForecast: boolean;
}

export type IrrigationTriggerType = 'AUTOMATED_DEFICIT' | 'MANUAL_OVERRIDE' | 'SCHEDULED_RECIPE';
export type IrrigationEventStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';

export interface IrrigationEvent {
  id: string;
  triggerType: IrrigationTriggerType;
  status: IrrigationEventStatus;
  scheduledStart: string;
  actualStart: string | null;
  completedAt: string | null;
  durationMinutes: number;
  waterVolumeLiters: number;
}

export interface TelemetryResponse {
  parcelId: string;
  window: TelemetryWindow;
  resolution: 'hour' | 'day';
  soil: SoilConstants | null;
  points: TelemetryPoint[];
  irrigationEvents: IrrigationEvent[];
}

export type ValveState = 'CLOSED' | 'OPENING' | 'PUMPING' | 'STOPPING';

export interface IrrigationStatus {
  valveState: ValveState;
  flowRateLpm: number;
  activeEvent: IrrigationEvent | null;
  nextScheduledEvent: IrrigationEvent | null;
  lastEvent: IrrigationEvent | null;
  serverTime: string;
}

export interface Sourced<T> {
  data: T;
  source: DataSource;
  fallbackReason: string | null;
}
