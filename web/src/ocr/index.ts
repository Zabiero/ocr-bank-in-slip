import type { AppSettings } from '../types';
import type { OcrEngine, OcrResult } from './engine';
import { tesseractEngine } from './tesseractEngine';
import { createCloudVisionEngine } from './cloudVisionEngine';
import { createPaddleOcrEngine } from './paddleOcrEngine';

export type { OcrEngine, OcrResult, OcrWord } from './engine';

export function getOcrEngine(settings: AppSettings): OcrEngine {
  if (settings.ocrEngine === 'cloud-vision') {
    return createCloudVisionEngine(settings.cloudVisionApiKey);
  }
  if (settings.ocrEngine === 'paddleocr') {
    return createPaddleOcrEngine(settings.paddleOcrServerUrl, settings.paddleOcrApiKey);
  }
  return tesseractEngine;
}

// PaddleOCR's server is a fragile free-tier deployment (see
// ocr-server/README.md) that can OOM-crash on a large or text-dense photo -
// unsuitable as everyone's primary engine. Instead, when Tesseract (the
// default, on-device engine) comes back with low confidence, PaddleOCR is
// tried as an automatic second opinion; any PaddleOCR failure or
// lower-than-Tesseract confidence silently falls back to the Tesseract
// result rather than surfacing an error - worst case is identical to not
// having PaddleOCR configured at all.
const FALLBACK_CONFIDENCE_THRESHOLD = 70;

export async function extractTextWithFallback(
  canvas: HTMLCanvasElement,
  settings: AppSettings,
): Promise<{ result: OcrResult; engineId: string }> {
  const primary = getOcrEngine(settings);
  const primaryResult = await primary.extractText(canvas);

  const canFallBackToPaddleOcr =
    primary.id === 'tesseract' &&
    primaryResult.confidence < FALLBACK_CONFIDENCE_THRESHOLD &&
    settings.paddleOcrServerUrl.trim() !== '';

  if (!canFallBackToPaddleOcr) {
    return { result: primaryResult, engineId: primary.id };
  }

  try {
    const paddleEngine = createPaddleOcrEngine(settings.paddleOcrServerUrl, settings.paddleOcrApiKey);
    const paddleResult = await paddleEngine.extractText(canvas);
    if (paddleResult.confidence > primaryResult.confidence) {
      return { result: paddleResult, engineId: paddleEngine.id };
    }
  } catch {
    // PaddleOCR unavailable - keep the Tesseract result below.
  }
  return { result: primaryResult, engineId: primary.id };
}
