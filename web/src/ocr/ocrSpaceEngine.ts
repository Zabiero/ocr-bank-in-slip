import type { OcrEngine, OcrResult, OcrWord } from './engine';

interface OcrSpaceWord {
  WordText: string;
  Left: number;
  Top: number;
  Height: number;
  Width: number;
}

interface OcrSpaceLine {
  Words?: OcrSpaceWord[];
}

interface OcrSpaceParsedResult {
  ParsedText?: string;
  ErrorMessage?: string | string[];
  TextOverlay?: { Lines?: OcrSpaceLine[] };
}

interface OcrSpaceResponse {
  ParsedResults?: OcrSpaceParsedResult[];
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
}

function firstErrorMessage(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * OCR.space (https://ocr.space/ocrapi), called directly from the browser
 * with a user-supplied API key - same shape as the Cloud Vision engine
 * (no server to host), but a different provider with its own free tier
 * (25k requests/month, no card needed) and its own limits (1MB per image
 * on the free plan - see the Settings panel disclosure for both).
 */
export function createOcrSpaceEngine(apiKey: string): OcrEngine {
  return {
    id: 'ocr-space',
    label: 'OCR.space (cloud, requires API key)',
    requiresNetwork: true,

    async extractText(image: HTMLCanvasElement): Promise<OcrResult> {
      if (!apiKey) {
        throw new Error('OCR.space is selected but no API key was set in Settings.');
      }

      const base64Image = image.toDataURL('image/jpeg', 0.92);

      const body = new URLSearchParams({
        apikey: apiKey,
        base64Image,
        language: 'eng',
        OCREngine: '2',
        scale: 'true',
        isOverlayRequired: 'true',
      });

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!res.ok) {
        throw new Error(`OCR.space request failed (${res.status})`);
      }

      const json: OcrSpaceResponse = await res.json();
      if (json.IsErroredOnProcessing) {
        throw new Error(firstErrorMessage(json.ErrorMessage) ?? 'OCR.space failed to process this image.');
      }

      const parsed = json.ParsedResults?.[0];
      if (!parsed || parsed.ErrorMessage) {
        throw new Error(firstErrorMessage(parsed?.ErrorMessage) ?? 'OCR.space returned no text.');
      }

      const boxes: OcrWord[] = [];
      for (const line of parsed.TextOverlay?.Lines ?? []) {
        for (const word of line.Words ?? []) {
          boxes.push({
            text: word.WordText,
            // OCR.space's API doesn't return a per-word confidence score.
            confidence: 80,
            bbox: { x0: word.Left, y0: word.Top, x1: word.Left + word.Width, y1: word.Top + word.Height },
          });
        }
      }

      return { text: parsed.ParsedText ?? '', confidence: 80, boxes };
    },
  };
}
