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

    // Plain insert, not upsert: record.id is a freshly generated UUID that
    // never already exists, and Postgres RLS requires an UPDATE policy to be
    // satisfiable for an ON CONFLICT DO UPDATE clause to even be planned -
    // regardless of whether a conflict actually occurs at runtime. The anon
    // role here only has an INSERT policy (see README.md "Central
    // record-keeping"), so upsert() failed with a 403/400 even on a brand
    // new row; insert() has no such requirement.
    const uploads: Promise<{ error: { message: string } | null }>[] = [];
    if (row.original_image_path && record.originalImageDataUrl) {
      uploads.push(
        supabase.storage
          .from(SLIP_IMAGES_BUCKET)
          .upload(row.original_image_path, dataUrlToBlob(record.originalImageDataUrl), { contentType: 'image/jpeg' }),
      );
    }
    if (row.processed_image_path && record.imageDataUrl) {
      uploads.push(
        supabase.storage
          .from(SLIP_IMAGES_BUCKET)
          .upload(row.processed_image_path, dataUrlToBlob(record.imageDataUrl), { contentType: 'image/jpeg' }),
      );
    }
    const uploadResults = await Promise.all(uploads);
    const uploadError = uploadResults.find((r) => r.error)?.error;
    if (uploadError) throw uploadError;

    const { error } = await supabase.from('slips').insert(row);
    if (error) throw error;
  } catch (err) {
    console.warn('Could not sync this slip to the central record (it is still saved locally):', err);
  }
}

/**
 * Syncs a manual field edit or a re-scan to the already-submitted central
 * row (images are unchanged in both cases, so only the row needs updating -
 * see submitSlipRecord for the initial upload). Same best-effort, silent
 * contract: never interrupts the local edit/rescan if this fails, including
 * when the slip was never submitted centrally in the first place (e.g.
 * Supabase was unreachable at scan time) - `update` on a missing id is a
 * harmless no-op, not an error.
 */
export async function updateSlipRecord(record: SlipRecord): Promise<void> {
  if (!supabase) return;

  try {
    const row = buildSlipRow(record);
    const { error } = await supabase.from('slips').update(row).eq('id', record.id);
    if (error) throw error;
  } catch (err) {
    console.warn('Could not sync this edit to the central record (it is still saved locally):', err);
  }
}
