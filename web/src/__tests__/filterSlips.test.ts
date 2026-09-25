import { describe, expect, it } from 'vitest';
import { filterSlips } from '../filterSlips';
import { EMPTY_FILTERS } from '../components/Filters';
import type { ParsedSlip, SlipRecord } from '../types';

function field<T>(value: T | null, confidence = 95): { value: T | null; confidence: number } {
  return { value, confidence };
}

function makeSlip(id: string, overrides: Partial<ParsedSlip> = {}): SlipRecord {
  const parsed: ParsedSlip = {
    date: field(null),
    time: field(null),
    amount: field(null),
    currency: field(null),
    referenceNo: field(null),
    bank: field(null),
    maskedAccountNumbers: [],
    ...overrides,
  };
  return {
    id,
    createdAt: Number(id),
    fileName: `${id}.jpg`,
    imageDataUrl: '',
    thumbnailDataUrl: '',
    ocrText: '',
    ocrConfidence: 90,
    ocrEngine: 'tesseract',
    parsed,
    status: 'ok',
  };
}

describe('filterSlips', () => {
  const slips = [
    makeSlip('a', { bank: field('Maybank'), referenceNo: field('MB-001'), date: field('01-09-2026') }),
    makeSlip('b', { bank: field('CIMB Bank'), referenceNo: field('CB-002'), date: field('15-09-2026') }),
    makeSlip('c', { bank: field('Maybank'), referenceNo: field('MB-003'), date: field('30-09-2026') }),
  ];

  it('returns everything when no filters are set', () => {
    expect(filterSlips(slips, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('filters by exact bank match', () => {
    const result = filterSlips(slips, { ...EMPTY_FILTERS, bank: 'Maybank' });
    expect(result.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('filters by reference no. substring, case-insensitively', () => {
    const result = filterSlips(slips, { ...EMPTY_FILTERS, search: 'cb-' });
    expect(result.map((s) => s.id)).toEqual(['b']);
  });

  it('filters by date range, excluding slips with no date', () => {
    const withMissingDate = [...slips, makeSlip('d')];
    const result = filterSlips(withMissingDate, { ...EMPTY_FILTERS, dateFrom: '2026-09-10', dateTo: '2026-09-20' });
    expect(result.map((s) => s.id)).toEqual(['b']);
  });
});
