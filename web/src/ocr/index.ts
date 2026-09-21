import type { AppSettings } from '../types';
import type { OcrEngine } from './engine';
import { tesseractEngine } from './tesseractEngine';
import { createCloudVisionEngine } from './cloudVisionEngine';
import { createPaddleOcrEngine } from './paddleOcrEngine';
import { createOcrSpaceEngine } from './ocrSpaceEngine';

export type { OcrEngine, OcrResult, OcrWord } from './engine';

export function getOcrEngine(settings: AppSettings): OcrEngine {
  if (settings.ocrEngine === 'cloud-vision') {
    return createCloudVisionEngine(settings.cloudVisionApiKey);
  }
  if (settings.ocrEngine === 'paddleocr') {
    return createPaddleOcrEngine(settings.paddleOcrServerUrl);
  }
  if (settings.ocrEngine === 'ocr-space') {
    return createOcrSpaceEngine(settings.ocrSpaceApiKey);
  }
  return tesseractEngine;
}
