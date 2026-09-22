import type { OcrEngine, OcrResult, OcrWord } from './engine';

interface PaddleOcrLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface PaddleOcrResponse {
  text: string;
  confidence: number;
  lines: PaddleOcrLine[];
}

/**
 * Talks to the optional local PaddleOCR server (see ocr-server/README.md at
 * the repo root). PaddleOCR is Python-only, so unlike Tesseract.js it can't
 * run inside the browser - this engine posts the preprocessed slip image to
 * a server running on the user's own machine and reads back the result.
 * Nothing leaves the user's computer; it's a second local process instead
 * of a cloud dependency.
 */
export function createPaddleOcrEngine(serverUrl: string, apiKey = ''): OcrEngine {
  const base = serverUrl.replace(/\/+$/, '');

  return {
    id: 'paddleocr',
    label: 'PaddleOCR (local server)',
    requiresNetwork: false,

    async extractText(image: HTMLCanvasElement): Promise<OcrResult> {
      const blob = await new Promise<Blob | null>((resolve) => image.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        throw new Error('Could not encode the image to send to PaddleOCR.');
      }

      const formData = new FormData();
      formData.append('file', blob, 'slip.jpg');

      let res: Response;
      try {
        res = await fetch(`${base}/ocr`, {
          method: 'POST',
          headers: apiKey ? { 'X-API-Key': apiKey } : undefined,
          body: formData,
        });
      } catch {
        throw new Error(
          `Could not reach the PaddleOCR server at ${base}. Make sure it's running - see ocr-server/README.md.`,
        );
      }

      if (res.status === 401) {
        throw new Error('PaddleOCR server rejected the request - check the API key in Settings.');
      }
      if (!res.ok) {
        throw new Error(`PaddleOCR server returned an error (HTTP ${res.status}).`);
      }

      const data: PaddleOcrResponse = await res.json();
      const boxes: OcrWord[] = (data.lines ?? []).map((line) => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox,
      }));

      return { text: data.text ?? '', confidence: data.confidence ?? 0, boxes };
    },
  };
}
