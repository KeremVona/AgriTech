/**
 * Node.js Asset Verification Script for CI and Local Development.
 * Validates manifest.json, WebP binary signatures, file sizes, and paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '../public/progression');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const MAX_FILE_SIZE_BYTES = 150 * 1024; // 150 KB

console.log('--- Verifying Disease Progression Assets & Manifest ---');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`[FAIL] Manifest missing at: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
const manifest = JSON.parse(manifestRaw);

if (!manifest.crops || manifest.crops.length !== 4) {
  console.error(`[FAIL] Expected 4 crops, found: ${manifest.crops ? manifest.crops.length : 0}`);
  process.exit(1);
}

let imageCount = 0;
let maskCount = 0;

for (const crop of manifest.crops) {
  if (!crop.stages || crop.stages.length !== 3) {
    console.error(`[FAIL] Crop ${crop.crop_id} must have exactly 3 stages`);
    process.exit(1);
  }

  for (const stage of crop.stages) {
    // 1. Verify Base Image
    const baseRel = stage.assets.base_image_url.replace(/^\/progression\//, '');
    const basePath = path.join(PUBLIC_DIR, baseRel);

    if (!fs.existsSync(basePath)) {
      console.error(`[FAIL] Base image file missing: ${basePath}`);
      process.exit(1);
    }

    const baseStats = fs.statSync(basePath);
    if (baseStats.size > MAX_FILE_SIZE_BYTES) {
      console.error(`[FAIL] Image ${baseRel} exceeds 150 KB: ${(baseStats.size / 1024).toFixed(1)} KB`);
      process.exit(1);
    }

    // Check WebP Header signature (RIFF....WEBP)
    const baseBuffer = fs.readFileSync(basePath);
    const isWebP = baseBuffer.subarray(0, 4).toString() === 'RIFF' && baseBuffer.subarray(8, 12).toString() === 'WEBP';
    if (!isWebP) {
      console.error(`[FAIL] Image ${baseRel} is not a valid WebP file`);
      process.exit(1);
    }

    imageCount++;

    // 2. Verify Companion Mask if defined
    if (stage.assets.mask_image_url) {
      const maskRel = stage.assets.mask_image_url.replace(/^\/progression\//, '');
      const maskPath = path.join(PUBLIC_DIR, maskRel);

      if (!fs.existsSync(maskPath)) {
        console.error(`[FAIL] Mask image file missing: ${maskPath}`);
        process.exit(1);
      }

      const maskStats = fs.statSync(maskPath);
      if (maskStats.size > MAX_FILE_SIZE_BYTES) {
        console.error(`[FAIL] Mask ${maskRel} exceeds 150 KB: ${(maskStats.size / 1024).toFixed(1)} KB`);
        process.exit(1);
      }

      const maskBuffer = fs.readFileSync(maskPath);
      const isMaskWebP = maskBuffer.subarray(0, 4).toString() === 'RIFF' && maskBuffer.subarray(8, 12).toString() === 'WEBP';
      if (!isMaskWebP) {
        console.error(`[FAIL] Mask ${maskRel} is not a valid WebP file`);
        process.exit(1);
      }

      maskCount++;
    }
  }
}

console.log(`[PASS] Verified ${manifest.crops.length} crops in manifest.json`);
console.log(`[PASS] Verified ${imageCount} base WebP leaf images (all < 150 KB)`);
console.log(`[PASS] Verified ${maskCount} transition WebP mask images (all < 150 KB)`);
console.log('All frontend asset checks passed successfully!\n');
