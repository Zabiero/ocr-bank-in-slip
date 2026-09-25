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
  /** Preprocessed (cropped, deskewed, black-and-white) image, stored as a data URL so it round-trips through IndexedDB. */
  imageDataUrl: string;
  /** Small thumbnail for the results table. */
  thumbnailDataUrl: string;
  /** The original photo in full colour, only upright (EXIF-rotated) - before crop/deskew/thresholding. */
  originalImageDataUrl?: string;
  /** Raw OCR text with any detected account numbers masked out. */
  ocrText: string;
  ocrConfidence: number;
  ocrEngine: string;
  parsed: ParsedSlip;
  status: SlipStatus;
  errorMessage?: string;
}

export type OcrEngineId = 'tesseract' | 'cloud-vision';

export interface AppSettings {
  ocrEngine: OcrEngineId;
  /** User-supplied key for the optional cloud OCR engine. Stored in localStorage only. */
  cloudVisionApiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ocrEngine: 'tesseract',
  cloudVisionApiKey: '',
};

export interface Bank {
  name: string;
  aliases: string[];
  /** For documents that never print the bank's name as text (logo only):
   * phrases from its standard wording that must ALL appear to identify it. */
  fingerprint?: string[];
}
