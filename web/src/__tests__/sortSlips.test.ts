import { describe, expect, it } from 'vitest';
import { sortSlips } from '../sortSlips';
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

describe('sortSlips', () => {
  it('sorts by date, oldest to latest', () => {
    const slips = [
      makeSlip('a', { date: field('15-09-2026') }),
      makeSlip('b', { date: field('01-01-2026') }),
      makeSlip('c', { date: field('20-12-2026') }),
    ];

    expect(sortSlips(slips, 'date', 'asc').map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by amount, highest to lowest', () => {
    const slips = [
      makeSlip('a', { amount: field(50) }),
      makeSlip('b', { amount: field(500) }),
      makeSlip('c', { amount: field(5) }),
    ];

    expect(sortSlips(slips, 'amount', 'desc').map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('always sorts missing values to the bottom, regardless of direction', () => {
    const slips = [
      makeSlip('a', { amount: field(50) }),
      makeSlip('b', { amount: field(null) }),
      makeSlip('c', { amount: field(500) }),
    ];

    expect(sortSlips(slips, 'amount', 'asc').map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(sortSlips(slips, 'amount', 'desc').map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts bank/wallet name alphabetically', () => {
    const slips = [
      makeSlip('a', { bank: field('RHB Bank') }),
      makeSlip('b', { bank: field('AEON Bank') }),
      makeSlip('c', { bank: field('Maybank') }),
    ];

    expect(sortSlips(slips, 'bank', 'asc').map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the original array', () => {
    const slips = [makeSlip('a', { amount: field(50) }), makeSlip('b', { amount: field(5) })];
    const original = [...slips];

    sortSlips(slips, 'amount', 'asc');

    expect(slips).toEqual(original);
  });
});
