import { describe, expect, it } from 'vitest';
import { buildSlipRow, dataUrlToBlob } from '../collectSubmission';
import type { ParsedSlip, SlipRecord } from '../types';

function field<T>(value: T | null, confidence = 95): { value: T | null; confidence: number } {
  return { value, confidence };
}

function makeSlip(overrides: Partial<ParsedSlip> = {}, recordOverrides: Partial<SlipRecord> = {}): SlipRecord {
  const parsed: ParsedSlip = {
    date: field('12-09-2026'),
    time: field('02:35:00 PM'),
    amount: field(1250),
    currency: field('MYR'),
    referenceNo: field('MB20260912987654'),
    bank: field('Maybank'),
    maskedAccountNumbers: ['1234••••••6789'],
    ...overrides,
  };
  return {
    id: 'abc-123',
    createdAt: 1_700_000_000_000,
    fileName: 'slip.jpg',
    imageDataUrl: 'data:image/jpeg;base64,AAA',
    thumbnailDataUrl: '',
    originalImageDataUrl: 'data:image/jpeg;base64,BBB',
    ocrText: 'Maybank2u\nAmount: RM1,250.00',
    ocrConfidence: 88,
    ocrEngine: 'tesseract',
    parsed,
    status: 'ok',
    ...recordOverrides,
  };
}

describe('buildSlipRow', () => {
  it('flattens a parsed slip into the Supabase row shape', () => {
    const row = buildSlipRow(makeSlip());

    expect(row).toEqual({
      id: 'abc-123',
      created_at: new Date(1_700_000_000_000).toISOString(),
      file_name: 'slip.jpg',
      date: '12-09-2026',
      time: '02:35:00 PM',
      amount: 1250,
      currency: 'MYR',
      reference_no: 'MB20260912987654',
      bank: 'Maybank',
      status: 'ok',
      ocr_text: 'Maybank2u\nAmount: RM1,250.00',
      ocr_confidence: 88,
      ocr_engine: 'tesseract',
      masked_account_numbers: ['1234••••••6789'],
      original_image_path: 'abc-123/original.jpg',
      processed_image_path: 'abc-123/processed.jpg',
    });
  });

  it('leaves image paths null when a slip has no stored image (e.g. an error record)', () => {
    const row = buildSlipRow(makeSlip({}, { imageDataUrl: '', originalImageDataUrl: undefined }));

    expect(row.original_image_path).toBeNull();
    expect(row.processed_image_path).toBeNull();
  });
});

describe('dataUrlToBlob', () => {
  it('round-trips a data URL into a Blob of the right type and size', async () => {
    const original = 'hello world';
    const dataUrl = `data:image/jpeg;base64,${btoa(original)}`;

    const blob = dataUrlToBlob(dataUrl);

    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(original.length);
    expect(await blob.text()).toBe(original);
  });
});
