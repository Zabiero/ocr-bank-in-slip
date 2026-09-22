import { preprocessImage } from './imageProcessing/preprocess';
import { extractTextWithFallback } from './ocr';
import { parseSlip, computeStatus, emptyParsedSlip } from './parsing/parseSlip';
import type { AppSettings, ProcessingStage, SlipRecord } from './types';

export type OnStage = (stage: ProcessingStage) => void;

function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    if (/could not decode/i.test(err.message)) return 'Could not read this file. Try a clearer photo.';
    return err.message;
  }
  return 'Something went wrong while processing this slip.';
}

export async function processFile(file: File, settings: AppSettings, onStage?: OnStage): Promise<SlipRecord> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();

  try {
    onStage?.('preprocessing');
    const { canvas, imageDataUrl, thumbnailDataUrl } = await preprocessImage(file);

    onStage?.('ocr');
    const { result: ocrResult, engineId } = await extractTextWithFallback(canvas, settings);

    onStage?.('parsing');
    const { parsed, maskedText } = parseSlip(ocrResult.text, { dateAmbiguityMode: settings.dateAmbiguityMode });
    const status = computeStatus(parsed);

    if (!maskedText.trim()) {
      return {
        id,
        createdAt,
        fileName: file.name,
        imageDataUrl,
        thumbnailDataUrl,
        ocrText: '',
        ocrConfidence: ocrResult.confidence,
        ocrEngine: engineId,
        parsed: emptyParsedSlip(),
        status: 'error',
        errorMessage: 'No text found — the photo may be too blurry or dark. Try retaking it.',
      };
    }

    return {
      id,
      createdAt,
      fileName: file.name,
      imageDataUrl,
      thumbnailDataUrl,
      ocrText: maskedText,
      ocrConfidence: ocrResult.confidence,
      ocrEngine: engineId,
      parsed,
      status,
    };
  } catch (err) {
    return {
      id,
      createdAt,
      fileName: file.name,
      imageDataUrl: '',
      thumbnailDataUrl: '',
      ocrText: '',
      ocrConfidence: 0,
      ocrEngine: settings.ocrEngine,
      parsed: emptyParsedSlip(),
      status: 'error',
      errorMessage: friendlyError(err),
    };
  }
}

/** Re-runs OCR + parsing on an already-stored (preprocessed) slip image. */
export async function rescanSlip(record: SlipRecord, settings: AppSettings): Promise<SlipRecord> {
  if (!record.imageDataUrl) {
    return { ...record, status: 'error', errorMessage: 'No stored image to re-scan.' };
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not reload the stored image'));
      el.src = record.imageDataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);

    const { result: ocrResult, engineId } = await extractTextWithFallback(canvas, settings);
    const { parsed, maskedText } = parseSlip(ocrResult.text, { dateAmbiguityMode: settings.dateAmbiguityMode });

    return {
      ...record,
      ocrText: maskedText,
      ocrConfidence: ocrResult.confidence,
      ocrEngine: engineId,
      parsed,
      status: computeStatus(parsed),
      errorMessage: undefined,
    };
  } catch (err) {
    return { ...record, status: 'error', errorMessage: friendlyError(err) };
  }
}
