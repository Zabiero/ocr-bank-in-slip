import type { AppSettings } from '../types';
import type { OcrEngine } from './engine';
import { tesseractEngine } from './tesseractEngine';
import { createCloudVisionEngine } from './cloudVisionEngine';

export type { OcrEngine, OcrResult, OcrWord } from './engine';

export function getOcrEngine(settings: AppSettings): OcrEngine {
  if (settings.ocrEngine === 'cloud-vision') {
    return createCloudVisionEngine(settings.cloudVisionApiKey);
  }
  return tesseractEngine;
}
