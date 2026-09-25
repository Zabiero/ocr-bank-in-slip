export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrResult {
  text: string;
  /** Overall confidence, 0-100. */
  confidence: number;
  boxes?: OcrWord[];
}

/**
 * Swappable OCR backend. Every engine takes a preprocessed canvas and
 * returns plain text plus a confidence score - nothing else in the app
 * (parsing, storage, UI) needs to know which engine produced it.
 */
export interface OcrEngine {
  id: string;
  label: string;
  /** True for engines that send image bytes off-device (shown in Settings). */
  requiresNetwork: boolean;
  extractText(image: HTMLCanvasElement): Promise<OcrResult>;
  terminate?(): Promise<void>;
}
