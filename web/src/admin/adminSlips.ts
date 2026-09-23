import { supabase, SLIP_IMAGES_BUCKET } from '../lib/supabaseClient';
import type { SlipRow } from '../collectSubmission';
import type { ParsedSlip, SlipRecord } from '../types';

/** A row fetched from Supabase, mapped back into the app's SlipRecord shape
 * so the admin view can reuse sortSlips() and the same table styling. Image
 * fields are left empty here - actual image bytes are only fetched lazily,
 * as a signed URL, when the admin opens a specific slip's preview (see
 * getSignedImageUrls) - fetching every row's images just to list them would
 * be slow and wasteful for a table that may hold thousands of rows. */
export function rowToSlipRecord(row: SlipRow): SlipRecord {
  const field = <T>(value: T | null): { value: T | null; confidence: number } => ({
    value,
    confidence: value != null ? 95 : 0,
  });

  const parsed: ParsedSlip = {
    date: field(row.date),
    time: field(row.time),
    amount: field(row.amount),
    currency: field(row.currency),
    referenceNo: field(row.reference_no),
    bank: field(row.bank),
    maskedAccountNumbers: row.masked_account_numbers ?? [],
  };

  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    fileName: row.file_name,
    imageDataUrl: '',
    thumbnailDataUrl: '',
    ocrText: row.ocr_text,
    ocrConfidence: row.ocr_confidence,
    ocrEngine: row.ocr_engine,
    parsed,
    status: row.status as SlipRecord['status'],
  };
}

export async function fetchAllSlipRows(): Promise<SlipRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('slips').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as SlipRow[];
}

export async function deleteSlipRow(row: SlipRow): Promise<void> {
  if (!supabase) return;
  const paths = [row.original_image_path, row.processed_image_path].filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(SLIP_IMAGES_BUCKET).remove(paths);
  }
  const { error } = await supabase.from('slips').delete().eq('id', row.id);
  if (error) throw error;
}

/** Signed URLs expire quickly (5 min) - this is a private bucket, and a URL
 * only needs to live long enough to render in the preview modal. */
export async function getSignedImageUrls(row: SlipRow): Promise<{ original: string | null; processed: string | null }> {
  const client = supabase;
  if (!client) return { original: null, processed: null };

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data, error } = await client.storage.from(SLIP_IMAGES_BUCKET).createSignedUrl(path, 300);
    if (error) return null;
    return data.signedUrl;
  };

  const [original, processed] = await Promise.all([sign(row.original_image_path), sign(row.processed_image_path)]);
  return { original, processed };
}
