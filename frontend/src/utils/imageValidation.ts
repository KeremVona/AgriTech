import type { ImageValidationResult } from '../types/diagnostics';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
export const MIN_IMAGE_DIMENSION_PX = 224;

/**
 * Validates the MIME format against supported neural network inputs (JPEG, PNG).
 */
export function validateMimeType(mime: string): { valid: boolean; error?: string } {
  if (!mime || !ALLOWED_MIME_TYPES.includes(mime.toLowerCase())) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPEG (.jpg, .jpeg) and PNG (.png) images are supported.',
    };
  }
  return { valid: true };
}

/**
 * Validates payload size to prevent network buffer overflow.
 */
export function validateFileSize(bytes: number): { valid: boolean; error?: string } {
  if (bytes > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (bytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb}MB) exceeds maximum payload limit of 10MB. Please upload a smaller image.`,
    };
  }
  return { valid: true };
}

/**
 * Reads an image file into memory and validates dimensions without sending to server.
 */
export function validateImageDimensions(file: File): Promise<{ valid: boolean; error?: string; width: number; height: number }> {
  return new Promise((resolve) => {
    // Check if running in browser environment with URL.createObjectURL and Image
    if (typeof window === 'undefined' || !window.URL || typeof Image === 'undefined') {
      return resolve({ valid: true, width: MIN_IMAGE_DIMENSION_PX, height: MIN_IMAGE_DIMENSION_PX });
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);

      if (width < MIN_IMAGE_DIMENSION_PX || height < MIN_IMAGE_DIMENSION_PX) {
        return resolve({
          valid: false,
          error: `Image resolution is too low (${width}x${height}px). Minimum requirement is ${MIN_IMAGE_DIMENSION_PX}x${MIN_IMAGE_DIMENSION_PX}px for neural network feature extraction.`,
          width,
          height,
        });
      }

      resolve({ valid: true, width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Could not decode image header. The file may be corrupt or an unreadable format.',
        width: 0,
        height: 0,
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Full pre-flight validation pipeline checking format, payload size, and image dimensions.
 */
export async function validateLeafImage(file: File): Promise<ImageValidationResult> {
  const mimeCheck = validateMimeType(file.type);
  if (!mimeCheck.valid) {
    return {
      valid: false,
      error: mimeCheck.error,
      fileSizeMb: file.size / (1024 * 1024),
      mimeType: file.type,
    };
  }

  const sizeCheck = validateFileSize(file.size);
  if (!sizeCheck.valid) {
    return {
      valid: false,
      error: sizeCheck.error,
      fileSizeMb: file.size / (1024 * 1024),
      mimeType: file.type,
    };
  }

  const dimCheck = await validateImageDimensions(file);
  if (!dimCheck.valid) {
    return {
      valid: false,
      error: dimCheck.error,
      width: dimCheck.width,
      height: dimCheck.height,
      fileSizeMb: file.size / (1024 * 1024),
      mimeType: file.type,
    };
  }

  return {
    valid: true,
    width: dimCheck.width,
    height: dimCheck.height,
    fileSizeMb: file.size / (1024 * 1024),
    mimeType: file.type,
  };
}
