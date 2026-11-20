/**
 * Verifies every progression image the app references.
 *
 * Scans `src/` for `/progression-experimental/...` paths (used by the Disease
 * Progression Studio and the diagnostics sample presets) and checks that each
 * file exists under `public/`, is a real WebP (RIFF....WEBP header) and stays
 * under the 150 KB per-asset budget. This replaces the old manifest check,
 * which pointed at `public/progression/` after that folder was removed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const MAX_FILE_SIZE_BYTES = 150 * 1024;
const ASSET_PATTERN = /\/progression-experimental\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g)/g;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const referenced = new Set();
for (const file of sourceFiles(SRC_DIR)) {
  for (const match of fs.readFileSync(file, 'utf-8').matchAll(ASSET_PATTERN)) referenced.add(match[0]);
}

console.log('--- Verifying referenced Disease Progression assets ---');
const failures = [];
if (referenced.size === 0) failures.push('No /progression-experimental/ asset references found in src/ (pattern out of date?).');

for (const assetPath of [...referenced].sort()) {
  const filePath = path.join(PUBLIC_DIR, assetPath);
  if (!fs.existsSync(filePath)) {
    failures.push(`Missing: public${assetPath}`);
    continue;
  }
  const { size } = fs.statSync(filePath);
  if (size > MAX_FILE_SIZE_BYTES) failures.push(`Too large (${(size / 1024).toFixed(1)} KB > 150 KB): public${assetPath}`);
  if (assetPath.endsWith('.webp')) {
    const header = fs.readFileSync(filePath).subarray(0, 12);
    if (header.subarray(0, 4).toString() !== 'RIFF' || header.subarray(8, 12).toString() !== 'WEBP') {
      failures.push(`Not a valid WebP file: public${assetPath}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  process.exit(1);
}
console.log(`[PASS] ${referenced.size} referenced progression assets exist, are valid and within budget.`);
