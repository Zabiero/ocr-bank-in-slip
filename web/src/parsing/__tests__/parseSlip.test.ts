import { describe, expect, it } from 'vitest';
import { parseSlip, computeStatus } from '../parseSlip';

// Five+ real-world-shaped OCR text samples (line breaks and wording as
// Tesseract/cloud OCR would typically return them for Malaysian bank-in
// slips), covering different banks, date formats, and OCR quirks.

const MAYBANK_SLIP = `MAYBANK2U
Transfer Receipt
Date: 12/09/2026
Time: 14:35:02
Amount: RM1,250.00
To Account No: 1234567890123
Reference No: MB20260912987654
Transaction Successful`;

const CIMB_SLIP = `CIMB BANK BERHAD
Resit Transaksi
Tarikh: 12 Mac 2026
Masa: 09:15:00 AM
Jumlah: RM500.00
Rujukan: CIMB9988771`;

const PUBLIC_BANK_SLIP_MISSING_TIME = `PUBLIC BANK BERHAD
Instant Transfer
Date: 05/06/2026
TOTAL RM l,2S0.00
Ref No: PBB556677`;

const UNKNOWN_BANK_SLIP = `ONLINE BANKING RECEIPT
Date: 01-01-26
Time: 11:59:59 PM
Amount: MYR 75.50
Transaction ID: TXN0001122233`;

const HONG_LEONG_SLIP = `HONG LEONG BANK
Duitnow Transfer Receipt
Tarikh: 2026-09-12
Masa: 10:00:00 AM
Jumlah: $1,000.00
Rujukan: HLB77889900
Account No: 9988776655443322`;

const GARBAGE_OCR_TEXT = `##@@ !! blurry noise ###
xx yy zz 000 ...`;

describe('parseSlip', () => {
  it('extracts all fields confidently from a clean Maybank slip and masks the account number', () => {
    const { parsed, maskedText } = parseSlip(MAYBANK_SLIP);

    expect(parsed.date.value).toBe('12-09-2026');
    expect(parsed.time.value).toBe('02:35:02 PM');
    expect(parsed.amount.value).toBe(1250);
    expect(parsed.currency.value).toBe('MYR');
    expect(parsed.referenceNo.value).toBe('MB20260912987654');
    expect(parsed.bank.value).toBe('Maybank');
    expect(computeStatus(parsed)).toBe('ok');

    // The account number must never appear in full anywhere downstream.
    expect(maskedText).not.toContain('1234567890123');
    expect(parsed.maskedAccountNumbers[0]).toMatch(/\*+0123$/);
  });

  it('parses a Malay-labelled CIMB slip with a "12 Mac 2026" style date', () => {
    const { parsed } = parseSlip(CIMB_SLIP);

    expect(parsed.date.value).toBe('12-03-2026');
    expect(parsed.time.value).toBe('09:15:00 AM');
    expect(parsed.amount.value).toBe(500);
    expect(parsed.referenceNo.value).toBe('CIMB9988771');
    expect(parsed.bank.value).toBe('CIMB Bank');
    expect(computeStatus(parsed)).toBe('ok');
  });

  it('corrects common OCR digit confusions in the amount and flags a missing time as needs review', () => {
    const { parsed } = parseSlip(PUBLIC_BANK_SLIP_MISSING_TIME);

    // "l,2S0.00" -> "1,250.00"
    expect(parsed.amount.value).toBe(1250);
    expect(parsed.amount.confidence).toBeLessThan(95); // OCR fix lowers confidence
    expect(parsed.time.value).toBeNull();
    expect(parsed.time.confidence).toBe(0);
    expect(parsed.bank.value).toBe('Public Bank');
    expect(computeStatus(parsed)).toBe('needs_review');
  });

  it('normalizes a 2-digit year and flags an unrecognized bank instead of guessing one', () => {
    const { parsed } = parseSlip(UNKNOWN_BANK_SLIP);

    expect(parsed.date.value).toBe('01-01-2026');
    expect(parsed.time.value).toBe('11:59:59 PM');
    expect(parsed.amount.value).toBe(75.5);
    expect(parsed.referenceNo.value).toBe('TXN0001122233');
    expect(parsed.bank.value).toBe('Unknown');
    expect(parsed.bank.confidence).toBe(0);
    expect(computeStatus(parsed)).toBe('needs_review');
  });

  it('handles an ISO date, a bare "$" currency symbol, and masks a 16-digit account number', () => {
    const { parsed } = parseSlip(HONG_LEONG_SLIP);

    expect(parsed.date.value).toBe('12-09-2026');
    expect(parsed.amount.value).toBe(1000);
    expect(parsed.currency.value).toBe('MYR');
    expect(parsed.bank.value).toBe('Hong Leong Bank');
    expect(parsed.maskedAccountNumbers).toHaveLength(1);
    expect(parsed.maskedAccountNumbers[0]).toMatch(/\*+3322$/);
    expect(computeStatus(parsed)).toBe('ok');
  });

  it('never fabricates values when no usable text is found', () => {
    const { parsed } = parseSlip(GARBAGE_OCR_TEXT);

    expect(parsed.date.value).toBeNull();
    expect(parsed.time.value).toBeNull();
    expect(parsed.amount.value).toBeNull();
    expect(parsed.referenceNo.value).toBeNull();
    expect(parsed.bank.value).toBe('Unknown');
    expect(computeStatus(parsed)).toBe('needs_review');
  });

  it('resolves an ambiguous numeric date using the day-first vs month-first setting', () => {
    const dayFirst = parseSlip('Date: 03/04/2026\nAmount: RM10.00', { dateAmbiguityMode: 'day-first' });
    const monthFirst = parseSlip('Date: 03/04/2026\nAmount: RM10.00', { dateAmbiguityMode: 'month-first' });

    expect(dayFirst.parsed.date.value).toBe('03-04-2026');
    expect(monthFirst.parsed.date.value).toBe('04-03-2026');
  });
});
