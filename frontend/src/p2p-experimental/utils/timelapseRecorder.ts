/**
 * Automated WebGL Canvas 60 FPS Timelapse Video Recorder & Snapshot Utility
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 4)
 *
 * Utilizes:
 * - HTML5 canvas.captureStream()
 * - MediaRecorder API with VP9/VP8 WebM container codecs
 * - Programmatic frame-by-frame timeline progression sweep
 * - Automated browser file download trigger
 */

export interface TimelapseRecordingOptions {
  canvas: HTMLCanvasElement;
  onSetSliderPercentage: (pct: number) => void;
  targetMaxPercentage?: number;
  totalDurationMs?: number;
  fps?: number;
  onProgress?: (progressPct: number) => void;
}

/**
 * Detects whether the current browser runtime supports canvas.captureStream() and MediaRecorder.
 */
export function isTimelapseExportSupported(canvas?: HTMLCanvasElement | null): boolean {
  if (typeof window === 'undefined') return false;
  const hasMediaRecorder = typeof window.MediaRecorder !== 'undefined';
  const hasCaptureStream = !!(canvas && (canvas.captureStream || (canvas as unknown as { mozCaptureStream?: unknown }).mozCaptureStream));
  return hasMediaRecorder && hasCaptureStream;
}

/**
 * Resolves the best supported video MIME type for recording.
 */
export function getSupportedVideoMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return 'video/webm';
  }

  const preferredTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm;codecs=h264',
    'video/webm',
    'video/mp4',
  ];

  for (const mimeType of preferredTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return 'video/webm';
}

/**
 * Triggers a browser file download from a Blob or Data URL.
 */
export function triggerFileDownload(urlOrBlob: string | Blob, filename: string): void {
  const url = typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof urlOrBlob !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

/**
 * Captures an instantaneous high-resolution snapshot from a canvas and triggers a PNG download.
 */
export function captureAndDownloadCanvasSnapshot(
  canvas: HTMLCanvasElement,
  filename: string
): string {
  const dataUrl = canvas.toDataURL('image/png');
  triggerFileDownload(dataUrl, filename);
  return dataUrl;
}

/**
 * Programmatically animates through the progression timeline from 0% to targetMaxPercentage,
 * recording every frame from the WebGL canvas into a video Blob.
 */
export async function recordProgressionTimelapse(
  options: TimelapseRecordingOptions
): Promise<Blob> {
  const {
    canvas,
    onSetSliderPercentage,
    targetMaxPercentage = 100.0,
    totalDurationMs = 5000,
    fps = 30,
    onProgress,
  } = options;

  if (!isTimelapseExportSupported(canvas)) {
    throw new Error('Canvas recording is not supported in this browser environment.');
  }

  const mimeType = getSupportedVideoMimeType();
  const captureMethod = canvas.captureStream || (canvas as unknown as { mozCaptureStream: (fps: number) => MediaStream }).mozCaptureStream;
  const stream: MediaStream = captureMethod.call(canvas, fps);

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000, // 4 Mbps high clarity
  });

  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  const totalFrames = Math.round((totalDurationMs / 1000) * fps);
  const frameIntervalMs = totalDurationMs / totalFrames;

  // Wrap recording execution in Promise
  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (err) => reject(err);

    recorder.onstop = () => {
      const finalBlob = new Blob(recordedChunks, { type: mimeType });
      resolve(finalBlob);
    };

    recorder.start(100); // 100ms chunk slices

    let currentFrame = 0;

    const renderNextFrame = () => {
      if (currentFrame >= totalFrames) {
        onProgress?.(100);
        setTimeout(() => {
          recorder.stop();
        }, 200);
        return;
      }

      const normalizedProgress = currentFrame / (totalFrames - 1);
      const currentPct = normalizedProgress * targetMaxPercentage;

      onSetSliderPercentage(currentPct);
      onProgress?.(Math.round(normalizedProgress * 100));

      currentFrame++;
      setTimeout(renderNextFrame, frameIntervalMs);
    };

    // Kick off animation frames
    renderNextFrame();
  });
}
