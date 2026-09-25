import type { SlipRow } from '../collectSubmission';
import type { SlipRecord } from '../types';
import { getSignedImageUrls, rowToSlipRecord } from './adminSlips';

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * The admin table's own SlipRecords (from rowToSlipRecord) never carry image
 * data - fetching every row's image just to list them would be slow and
 * wasteful (see adminSlips.ts). Training-data export is the one export that
 * actually needs the image bytes, so it fetches them here, on demand, only
 * for the rows being exported. Sequential rather than parallel so exporting
 * a large filtered set doesn't fire hundreds of concurrent requests at once.
 */
export async function fetchRecordsWithImages(rows: SlipRow[]): Promise<SlipRecord[]> {
  const records: SlipRecord[] = [];
  for (const row of rows) {
    const record = rowToSlipRecord(row);
    const urls = await getSignedImageUrls(row);
    const imageDataUrl = urls.processed ? await fetchAsDataUrl(urls.processed) : '';
    records.push({ ...record, imageDataUrl });
  }
  return records;
}
