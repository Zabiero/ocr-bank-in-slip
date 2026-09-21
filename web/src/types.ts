/** Confidence is a 0-100 score. Fields below CONFIDENCE_WARN_THRESHOLD are
 * highlighted for review; a null value always means "not found" (never a guess). */
export const CONFIDENCE_WARN_THRESHOLD = 80;

export interface ParsedField<T> {
  value: T | null;
  /** 0 when the field could not be found at all. */
  confidence: number;
  /** The raw substring the value was extracted from, for debugging/edit context. */
  raw?: string;
}

export interface ParsedSlip {
  /** Normalized to DD-MM-YYYY */
  date: ParsedField<string>;
  /** Normalized to 12-hour hh:mm:ss AM/PM */
  time: ParsedField<string>;
  amount: ParsedField<number>;
  currency: ParsedField<string>;
  referenceNo: ParsedField<string>;
  bank: ParsedField<string>;
  /** Any account-number-like sequences found, already masked (e.g. "1234•••••6789"). */
  maskedAccountNumbers: string[];
}

export type SlipStatus = 'ok' | 'needs_review' | 'error' | 'duplicate';

export type ProcessingStage =
  | 'queued'
  | 'preprocessing'
  | 'ocr'
  | 'parsing'
  | 'done'
  | 'error';

export interface SlipRecord {
  id: string;
  createdAt: number;
  fileName: string;
  /** Preprocessed image, stored as a data URL so it round-trips through IndexedDB. */
  imageDataUrl: string;
  /** Small thumbnail for the results table. */
  thumbnailDataUrl: string;
  /** Raw OCR text with any detected account numbers masked out. */
  ocrText: string;
  ocrConfidence: number;
  ocrEngine: string;
  parsed: ParsedSlip;
  status: SlipStatus;
  errorMessage?: string;
}

export type DateAmbiguityMode = 'day-first' | 'month-first';

export type OcrEngineId = 'tesseract' | 'cloud-vision' | 'paddleocr' | 'ocr-space';

export interface AppSettings {
  dateAmbiguityMode: DateAmbiguityMode;
  ocrEngine: OcrEngineId;
  /** User-supplied key for the optional cloud OCR engine. Stored in localStorage only. */
  cloudVisionApiKey: string;
  /** Base URL of the optional local PaddleOCR server (see ocr-server/README.md). */
  paddleOcrServerUrl: string;
  /** User-supplied key for the optional OCR.space cloud engine. Stored in localStorage only. */
  ocrSpaceApiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  dateAmbiguityMode: 'day-first',
  ocrEngine: 'tesseract',
  cloudVisionApiKey: '',
  paddleOcrServerUrl: 'http://localhost:8000',
  ocrSpaceApiKey: '',
};

export interface Bank {
  name: string;
  aliases: string[];
}
