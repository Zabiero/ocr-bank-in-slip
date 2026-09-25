import type { SlipRecord } from '../types';

export interface TrainingExample {
  id: string;
  imageDataUrl: string;
  ocrEngine: string;
  ocrConfidence: number;
  ocrText: string;
  /** Field values as they stand now - correct if you've fixed any wrong ones in the table before exporting. */
  labels: {
    date: string | null;
    time: string | null;
    amount: number | null;
    referenceNo: string | null;
    bank: string | null;
  };
}

export interface TrainingDataExport {
  exportedAt: string;
  count: number;
  examples: TrainingExample[];
}

/**
 * Dumps each slip's preprocessed image alongside its current (i.e.
 * corrected, if you fixed anything in the table) field values and the raw
 * OCR text that produced them. Intended as a growing labeled dataset for
 * fine-tuning an OCR/recognition model on your own slip formats later -
 * review and fix any wrong fields in the table *before* exporting, since
 * whatever is on-screen becomes the training label.
 */
export function slipsToTrainingData(slips: SlipRecord[]): TrainingDataExport {
  const examples: TrainingExample[] = slips.map((slip) => ({
    id: slip.id,
    imageDataUrl: slip.imageDataUrl,
    ocrEngine: slip.ocrEngine,
    ocrConfidence: slip.ocrConfidence,
    ocrText: slip.ocrText,
    labels: {
      date: slip.parsed.date.value,
      time: slip.parsed.time.value,
      amount: slip.parsed.amount.value,
      referenceNo: slip.parsed.referenceNo.value,
      bank: slip.parsed.bank.value,
    },
  }));

  return { exportedAt: new Date().toISOString(), count: examples.length, examples };
}

export function downloadTrainingData(slips: SlipRecord[], fileName = 'bank-slips-training-data.json'): void {
  const json = JSON.stringify(slipsToTrainingData(slips), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
