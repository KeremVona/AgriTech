import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  APP_CTA, CROPS, DIAGNOSIS_FLOW, HERO_VIDEO_SRC, FEATURES, FOOTER_COLUMNS, IRRIGATION_FLOW, NAV_LINKS, PRIMARY_CTA, SECONDARY_CTA,
} from '../src/components/Landing/landingContent.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

// Every internal link must match a <Route path="..."> in App.tsx (fallback "*" excluded).
const routePatterns = [...read('src/App.tsx').matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path !== '*')
  .map((path) => new RegExp(`^${path.replace(/:[^/]+/g, '[^/?#]+')}(\\?.*)?$`));
const isRoute = (href) => routePatterns.some((pattern) => pattern.test(href));

// Every in-page anchor must point at an id rendered by the landing components.
const landingSource = readdirSync(`${root}src/components/Landing`)
  .map((file) => read(`src/components/Landing/${file}`))
  .join('\n');
const sectionIds = new Set([
  ...[...landingSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  DIAGNOSIS_FLOW.id,
  IRRIGATION_FLOW.id,
]);

const links = [
  ...NAV_LINKS.map((link) => link.href),
  PRIMARY_CTA.to, SECONDARY_CTA.to, APP_CTA.to,
  ...FEATURES.map((feature) => feature.to),
  ...FOOTER_COLUMNS.flatMap((column) => column.links.filter((link) => !link.external).map((link) => link.href)),
];
for (const href of links) {
  assert.notEqual(href, '#', 'no placeholder "#" links');
  if (href.startsWith('#')) assert.ok(sectionIds.has(href.slice(1)), `anchor ${href} has a matching section id`);
  else assert.ok(isRoute(href), `${href} resolves to a real route`);
}
for (const column of FOOTER_COLUMNS) {
  for (const link of column.links.filter((item) => item.external)) assert.match(link.href, /^https:\/\//);
}

// Crops mirror ml-service: 7 crops, real images on disk, names unique.
assert.equal(CROPS.length, 7);
assert.equal(new Set(CROPS.map((crop) => crop.name)).size, 7);
const images = [
  ...CROPS.flatMap((crop) => (crop.images ? [crop.images.healthy, crop.images.severe] : [])),
  ...[...landingSource.matchAll(/["`](\/progression-experimental\/[^"`$]+\.webp)["`]/g)].map((match) => match[1]),
];
for (const crop of ['potato_stage0_healthy', 'potato_stage1_early', 'potato_stage2_severe']) {
  images.push(`/progression-experimental/potato/${crop}.webp`);
}
for (const image of images) assert.ok(existsSync(`${root}public${image}`), `${image} exists in public/`);
assert.ok(existsSync(`${root}public${HERO_VIDEO_SRC}`), `${HERO_VIDEO_SRC} exists in public/`);

// ml-service's SUPPORTED_CLASSES is the source of truth for the condition lists.
const mlKeys = new Set();
const advisoryPath = `${root}../ml-service/advisory.py`;
if (existsSync(advisoryPath)) {
  const block = readFileSync(advisoryPath, 'utf8').match(/SUPPORTED_CLASSES[^=]*=\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'SUPPORTED_CLASSES found in ml-service/advisory.py');
  for (const match of block[1].matchAll(/"([a-z]+)\/([a-z0-9_]+)"/g)) {
    if (match[2] !== 'healthy') mlKeys.add(`${match[1]}/${match[2]}`);
  }
}
if (mlKeys.size > 0) {
  const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const landingKeys = new Set(CROPS.flatMap((crop) => crop.conditions.map((condition) => `${slug(crop.name)}/${slug(condition)}`)));
  assert.deepEqual([...landingKeys].sort(), [...mlKeys].sort(), 'crop conditions match ml-service class keys');
}

console.log(`PASS landing content: ${links.length} links, ${images.length} images, ${CROPS.length} crops`);
