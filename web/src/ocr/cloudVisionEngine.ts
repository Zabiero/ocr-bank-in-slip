import type { OcrEngine, OcrResult, OcrWord } from './engine';

function canvasToBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return dataUrl.split(',')[1] ?? '';
}

interface VisionWord {
  boundingBox?: { vertices: Array<{ x?: number; y?: number }> };
  symbols?: Array<{ text: string; confidence?: number }>;
}

interface VisionResponse {
  responses: Array<{
    fullTextAnnotation?: {
      text: string;
      pages?: Array<{
        confidence?: number;
        blocks?: Array<{
          paragraphs?: Array<{ words?: VisionWord[] }>;
        }>;
      }>;
    };
    error?: { message: string };
  }>;
}

/**
 * Google Cloud Vision (DOCUMENT_TEXT_DETECTION), called directly from the
 * browser with a user-supplied API key. This is the only place in the app
 * that sends image bytes off-device - it is opt-in, and the key never
 * leaves localStorage except in this request. See the Settings panel for
 * the disclosure shown to the user before this engine can be selected.
 */
export function createCloudVisionEngine(apiKey: string): OcrEngine {
  return {
    id: 'cloud-vision',
    label: 'Google Cloud Vision (cloud, requires API key)',
    requiresNetwork: true,

    async extractText(image: HTMLCanvasElement): Promise<OcrResult> {
      if (!apiKey) {
        throw new Error('Cloud Vision is selected but no API key was set in Settings.');
      }

      const body = {
        requests: [
          {
            image: { content: canvasToBase64(image) },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          },
        ],
      };

      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Cloud Vision request failed (${res.status})`);
      }

      const json: VisionResponse = await res.json();
      const response = json.responses?.[0];
      if (response?.error) {
        throw new Error(response.error.message);
      }

      const annotation = response?.fullTextAnnotation;
      if (!annotation) {
        return { text: '', confidence: 0, boxes: [] };
      }

      const boxes: OcrWord[] = [];
      let confidenceSum = 0;
      let confidenceCount = 0;

      for (const page of annotation.pages ?? []) {
        if (typeof page.confidence === 'number') {
          confidenceSum += page.confidence;
          confidenceCount += 1;
        }
        for (const block of page.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const word of paragraph.words ?? []) {
              const text = (word.symbols ?? []).map((s) => s.text).join('');
              const vertices = word.boundingBox?.vertices ?? [];
              const xs = vertices.map((v) => v.x ?? 0);
              const ys = vertices.map((v) => v.y ?? 0);
              const wordConfidences = (word.symbols ?? []).map((s) => s.confidence ?? 0);
              const avgWordConfidence =
                wordConfidences.length > 0 ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length : 0;
              boxes.push({
                text,
                confidence: avgWordConfidence * 100,
                bbox: {
                  x0: Math.min(...xs, 0),
                  y0: Math.min(...ys, 0),
                  x1: Math.max(...xs, 0),
                  y1: Math.max(...ys, 0),
                },
              });
            }
          }
        }
      }

      const confidence = confidenceCount > 0 ? (confidenceSum / confidenceCount) * 100 : 90;

      return { text: annotation.text, confidence, boxes };
    },
  };
}
