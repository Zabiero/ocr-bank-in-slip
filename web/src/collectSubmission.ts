import { supabase, SLIP_IMAGES_BUCKET } from './lib/supabaseClient';
import type { SlipRecord } from './types';

/** Flat row shape for the Supabase `slips` table - see README.md "Central record-keeping" for the SQL. */
export interface SlipRow {
  id: string;
  created_at: string;
  file_name: string;
  date: string | null;
  time: string | null;
  amount: number | null;
  currency: string | null;
  reference_no: string | null;
  bank: string | null;
  status: string;
  ocr_text: string;
  ocr_confidence: number;
  ocr_engine: string;
  masked_account_numbers: string[];
  original_image_path: string | null;
  processed_image_path: string | null;
}

export function buildSlipRow(record: SlipRecord): SlipRow {
  return {
    id: record.id,
    created_at: new Date(record.createdAt).toISOString(),
    file_name: record.fileName,
    date: record.parsed.date.value,
    time: record.parsed.time.value,
    amount: record.parsed.amount.value,
    currency: record.parsed.currency.value,
    reference_no: record.parsed.referenceNo.value,
    bank: record.parsed.bank.value,
    status: record.status,
    ocr_text: record.ocrText,
    ocr_confidence: record.ocrConfidence,
    ocr_engine: record.ocrEngine,
    masked_account_numbers: record.parsed.maskedAccountNumbers,
    original_image_path: record.originalImageDataUrl ? `${record.id}/original.jpg` : null,
    processed_image_path: record.imageDataUrl ? `${record.id}/processed.jpg` : null,
  };
}

/** data: URL -> Blob, for uploading to Supabase Storage (which takes a Blob/File, not a data URL). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Uploads one completed scan to the central Supabase record (images + the
 * parsed row) for the business owner's admin view. Best-effort and silent:
 * if Supabase isn't configured (see supabaseClient.ts), or the network call
 * fails, this must never interrupt the cashier's own local scanning flow -
 * it's a side record, not the primary feature.
 */
export async function submitSlipRecord(record: SlipRecord): Promise<void> {
  if (!supabase) return;

  try {
    const row = buildSlipRow(record);

    const uploads: Promise<unknown>[] = [];
    if (row.original_image_path && record.originalImageDataUrl) {
      uploads.push(
        supabase.storage
          .from(SLIP_IMAGES_BUCKET)
          .upload(row.original_image_path, dataUrlToBlob(record.originalImageDataUrl), {
            contentType: 'image/jpeg',
            upsert: true,
          }),
      );
    }
    if (row.processed_image_path && record.imageDataUrl) {
      uploads.push(
        supabase.storage
          .from(SLIP_IMAGES_BUCKET)
          .upload(row.processed_image_path, dataUrlToBlob(record.imageDataUrl), {
            contentType: 'image/jpeg',
            upsert: true,
          }),
      );
    }
    await Promise.all(uploads);

    const { error } = await supabase.from('slips').upsert(row);
    if (error) throw error;
  } catch (err) {
    console.warn('Could not sync this slip to the central record (it is still saved locally):', err);
  }
}
