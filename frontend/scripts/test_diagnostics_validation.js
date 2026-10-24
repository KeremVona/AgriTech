import assert from 'node:assert/strict';

// Test pure validation functions
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MIN_DIMENSION_PX = 224;

function checkMime(mime) {
  if (!mime || !ALLOWED_MIME_TYPES.includes(mime.toLowerCase())) {
    return { valid: false, error: 'Invalid file format. Only JPEG and PNG images are supported.' };
  }
  return { valid: true };
}

function checkSize(bytes) {
  if (bytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File size exceeds maximum payload limit of 10MB.' };
  }
  return { valid: true };
}

function checkDimensions(width, height) {
  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
    return {
      valid: false,
      error: `Resolution too low (${width}x${height}px). Minimum requirement is ${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px for neural network feature extraction.`,
    };
  }
  return { valid: true };
}

function prettyLabel(label) {
  return label
    .split('___')
    .map((part) => part.replace(/_/g, ' ').trim())
    .join(' - ');
}

function mapSeverity(rawSeverity, condition) {
  const norm = (rawSeverity || '').toLowerCase();
  const condNorm = (condition || '').toLowerCase();

  if (norm === 'healthy' || condNorm.includes('healthy')) {
    return { severityTier: 'Tier 0', severityIndex: 'Healthy' };
  }
  if (norm === 'low') {
    return { severityTier: 'Tier 1', severityIndex: 'Low' };
  }
  if (norm === 'moderate' || norm === 'medium') {
    return { severityTier: 'Tier 2', severityIndex: 'Moderate' };
  }
  return { severityTier: 'Tier 3', severityIndex: 'Critical' };
}

// 1. MIME Validation Tests
console.log('Testing MIME Validation...');
assert.equal(checkMime('image/jpeg').valid, true);
assert.equal(checkMime('image/png').valid, true);
assert.equal(checkMime('image/gif').valid, false);
assert.equal(checkMime('application/pdf').valid, false);
assert.equal(checkMime('').valid, false);

// 2. Size Validation Tests
console.log('Testing File Size Limits...');
assert.equal(checkSize(1024 * 1024).valid, true); // 1MB
assert.equal(checkSize(10 * 1024 * 1024).valid, true); // 10MB exact
assert.equal(checkSize(10 * 1024 * 1024 + 1).valid, false); // 10MB + 1 byte
assert.equal(checkSize(50 * 1024 * 1024).valid, false); // 50MB

// 3. Dimension Tests
console.log('Testing Minimum Resolution...');
assert.equal(checkDimensions(224, 224).valid, true);
assert.equal(checkDimensions(1920, 1080).valid, true);
assert.equal(checkDimensions(223, 500).valid, false);
assert.equal(checkDimensions(100, 100).valid, false);

// 4. Label Formatting
console.log('Testing Label Formatting...');
assert.equal(prettyLabel('Tomato___Late_blight'), 'Tomato - Late blight');
assert.equal(prettyLabel('Corn_(maize)___Common_rust_'), 'Corn (maize) - Common rust');

// 5. Severity Mapping
console.log('Testing Severity Tier Ramp...');
assert.deepEqual(mapSeverity('Healthy', 'healthy'), { severityTier: 'Tier 0', severityIndex: 'Healthy' });
assert.deepEqual(mapSeverity('Low', 'Early chlorosis'), { severityTier: 'Tier 1', severityIndex: 'Low' });
assert.deepEqual(mapSeverity('Moderate', 'Leaf Spot'), { severityTier: 'Tier 2', severityIndex: 'Moderate' });
assert.deepEqual(mapSeverity('High', 'Late Blight'), { severityTier: 'Tier 3', severityIndex: 'Critical' });
assert.deepEqual(mapSeverity('Critical', 'Late Blight'), { severityTier: 'Tier 3', severityIndex: 'Critical' });

console.log('All diagnostics pre-flight and mapping sanity checks passed successfully!');
