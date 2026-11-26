import { waterDashboardPath } from '../../utils/irrigationRoutes.ts';

/**
 * All copy, links and crop data for the landing page (`/`).
 * Kept as plain data so `scripts/test_landing_content.js` can check every link and image.
 * Design: docs/superpowers/specs/2026-11-26-landing-notion-redesign-design.md
 */

/** Demo parcel from `data/sampleFarmMap.ts`; its water dashboard works in sample and auto mode. */
export const DEMO_PARCEL_ID = '20700000-0000-4000-8000-000000000001';

export const REPOSITORY_URL = 'https://github.com/KeremVona/AgriTech';

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Crops', href: '#crops' },
];

export const PRIMARY_CTA = { label: 'Open the field map', to: '/map' } as const;
export const SECONDARY_CTA = { label: 'Scan a leaf', to: '/diagnostics' } as const;
export const APP_CTA = { label: 'Open app', to: '/map' } as const;

export const HERO = {
  title: ['Know what your field needs,', 'before it shows.'],
  subtitle: 'AgriTech maps your parcels, diagnoses leaf disease from one photo, and tells you when to water. All in one place.',
} as const;

export type FeaturePreviewKind = 'map' | 'diagnostics' | 'progression' | 'water';

export interface Feature {
  id: FeaturePreviewKind;
  title: string;
  body: string;
  linkLabel: string;
  to: string;
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'map',
    title: 'Field map',
    body: 'Draw your parcels on satellite imagery. Crop, soil and area are kept with each parcel.',
    linkLabel: 'Open the map',
    to: '/map',
  },
  {
    id: 'diagnostics',
    title: 'Leaf diagnostics',
    body: 'Upload a photo of a leaf and get the disease, how sure the model is, and what to do today.',
    linkLabel: 'Scan a leaf',
    to: '/diagnostics',
  },
  {
    id: 'progression',
    title: 'Disease progression',
    body: 'Watch how a disease spreads across a leaf, from the first spots to a severe infection.',
    linkLabel: 'Open the studio',
    to: '/disease-progression',
  },
  {
    id: 'water',
    title: 'Water dashboard',
    body: 'Soil moisture, the water budget and the valve for each parcel, on one screen.',
    linkLabel: 'See a demo parcel',
    to: waterDashboardPath(DEMO_PARCEL_ID),
  },
];

export interface FlowStep {
  title: string;
  detail: string;
}

export interface FlowSection {
  id: string;
  title: string;
  /** Inputs are stacked in one column before the hub. */
  inputs: readonly FlowStep[];
  hub: FlowStep;
  outputs: readonly FlowStep[];
  points: readonly { title: string; body: string }[];
}

export const DIAGNOSIS_FLOW: FlowSection = {
  id: 'how-it-works',
  title: 'From one photo to a treatment plan.',
  inputs: [{ title: 'Leaf photo', detail: 'From a phone or an upload' }],
  hub: { title: 'Plant ML model', detail: '7 crops, healthy or diseased' },
  outputs: [
    { title: 'AI advice', detail: 'Gemini, saved per disease' },
    { title: 'Action today', detail: 'Treatments and risk factors' },
  ],
  points: [
    { title: 'No lab to wait for', body: 'The model runs on the project’s own ML service, so a photo is all it takes to get an answer.' },
    { title: 'The same advice every time', body: 'Advice for each disease is written once by the AI, saved, and reused for every later scan.' },
    { title: 'Honest when unsure', body: 'When a photo is unclear, AgriTech asks for a new one instead of guessing.' },
  ],
};

export const IRRIGATION_FLOW: FlowSection = {
  id: 'irrigation',
  title: 'Water only when the soil asks.',
  inputs: [
    { title: 'Weather', detail: 'Daily forecast from Open-Meteo' },
    { title: 'Soil sensors', detail: 'Moisture readings (simulated)' },
    { title: 'Crop stage', detail: 'FAO-56 crop coefficient' },
  ],
  hub: { title: 'Water balance engine', detail: 'FAO-56 root-zone deficit' },
  outputs: [{ title: 'Valve', detail: 'Opens at the trigger, logs every run' }],
  points: [
    { title: 'At the right moment', body: 'Watering starts when the root zone reaches what the crop can safely lose, not on a fixed timer.' },
    { title: 'Weather-aware', body: 'Daily evaporation and rainfall feed the water balance for every parcel.' },
    { title: 'You stay in control', body: 'Start or stop a run by hand from the parcel’s water dashboard.' },
  ],
};

export interface Crop {
  name: string;
  /** Conditions the `ml-service` classifier detects besides "healthy". */
  conditions: readonly string[];
  /** Healthy and severe leaf images under `public/`, or null when no photo exists yet. */
  images: { healthy: string; severe: string } | null;
}

const leaf = (crop: string) => ({
  healthy: `/progression-experimental/${crop}/${crop}_stage0_healthy.webp`,
  severe: `/progression-experimental/${crop}/${crop}_stage2_severe.webp`,
});

/** Mirrors `SUPPORTED_CLASSES` in `ml-service/advisory.py` (33 classes: 7 healthy + 26 conditions). */
export const CROPS: readonly Crop[] = [
  { name: 'Tomato', conditions: ['Early blight', 'Late blight', 'Septoria leaf spot'], images: leaf('tomato') },
  { name: 'Potato', conditions: ['Early blight', 'Late blight'], images: leaf('potato') },
  {
    name: 'Corn',
    conditions: ['Common rust', 'Gray leaf spot', 'Northern leaf blight', 'Northern leaf spot', 'Maize lethal necrosis', 'Maize streak virus'],
    images: leaf('corn'),
  },
  { name: 'Apple', conditions: ['Scab', 'Cedar apple rust', 'Powdery mildew', 'Frog-eye leaf spot'], images: leaf('apple') },
  { name: 'Grape', conditions: ['Downy mildew', 'Esca'], images: leaf('grape') },
  { name: 'Rice', conditions: ['Blast', 'Brown spot', 'Bacterial leaf blight', 'Tungro', 'Hispa'], images: null },
  { name: 'Cassava', conditions: ['Mosaic', 'Brown streak', 'Bacterial blight', 'Green mite'], images: null },
];

export const CLOSING = { title: 'Start with your first field.' } as const;

export interface FooterColumn {
  title: string;
  links: readonly { label: string; href: string; external?: boolean }[];
}

export const FOOTER_NOTE = 'A graduation project in precision agriculture: field mapping, leaf diagnostics and smart irrigation.';

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Field map', href: '/map' },
      { label: 'Leaf diagnostics', href: '/diagnostics' },
      { label: 'Disease progression', href: '/disease-progression' },
      { label: 'Water dashboard', href: waterDashboardPath(DEMO_PARCEL_ID) },
    ],
  },
  {
    title: 'How it works',
    links: [
      { label: 'Diagnosis', href: '#how-it-works' },
      { label: 'Irrigation', href: '#irrigation' },
      { label: 'Supported crops', href: '#crops' },
    ],
  },
  {
    title: 'Project',
    links: [{ label: 'GitHub repository', href: REPOSITORY_URL, external: true }],
  },
];
