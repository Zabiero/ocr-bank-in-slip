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

// Actual Tesseract output (captured verbatim, via the app's "View text")
// from a real Maybank2u "Share Receipt" screenshot. Mobile receipt screens
// like this put a field's label on one line and its value on the line
// below rather than "Label: value" on one line, AND Tesseract's sparse-text
// mode separates every detected fragment with a blank line - both need
// handling. OCR also completely failed to read the small gray
// "31 Jul 2026, 12:42 PM" timestamp text (not garbled - simply absent),
// which is a real OCR/resolution limitation, not something parsing can
// recover; date/time are expected to stay null here.
const MOBILE_SHARE_RECEIPT_SLIP = `12:429

"

= ea

Share Receipt

@ Maybank

Third Party Transfer

Reference ID

960386438M

Beneficiary name

INTERNATIONAL MONTES

Beneficiary account number

5623 8458 1700

Recipient reference

Cyrus See Yu Yang

Amount

RM 1500.00

Malayan Banking Berhad (Co. Reg.

196001000142)

Maybank Islamic Berhad (Co. Reg.

200701029411)`;

// Actual PaddleOCR output (its rec_texts, joined with newlines - the app's
// PaddleOCR engine does the same) from the same real Maybank2u screenshot.
// Unlike Tesseract, PaddleOCR read the "31 Jul 2026, 12:42 PM" timestamp
// correctly - but its reading order puts that date/time line *between*
// "Reference ID" and its actual value ("960386438M"), which a lookahead of
// only one line would miss entirely, spilling over into matching an
// unrelated "Recipient reference" field (the payer's own name) instead.
const PADDLEOCR_MOBILE_SHARE_RECEIPT_SLIP = `←
Share Receipt
Maybank
Third Party Transfer
Successful
Reference ID
31 Jul 2026, 12:42 PM
960386438M
Beneficiary name
INTERNATIONAL MONTES
Beneficiary account number
5623 8458 1700
Recipient reference
Cyrus See Yu Yang
Amount
RM 1500.00
Note: This receipt is computer generated and no
signature is required.
Malayan Banking Berhad (Co. Reg. : 196001000142)
Maybank Islamic Berhad (Co. Reg. : 200701029411)`;

// A later PaddleOCR run of the same slip recognized the date/time line
// with its spaces collapsed ("31Jul2026,12:42PM" instead of
// "31 Jul 2026, 12:42 PM") - real OCR output for the same input isn't
// perfectly stable between runs/settings. That merged blob must still
// parse as a date, and must not get picked up as the reference number
// just because it's alphanumeric and sits right after "Reference ID".
const PADDLEOCR_NO_SPACE_DATE_SLIP = `Reference ID
31Jul2026,12:42PM
960386438M
Amount
RM 1500.00`;

// A real AEON Bank transfer receipt whose body also names the *recipient's*
// bank ("RHB Bank Berhad", under "Transfer to") further down the page.
// The issuing bank (AEON Bank, in the header) must win, not the later,
// unrelated bank name.
const AEON_BANK_SLIP = `AEON Bank
17 Sep 2026, 06:24PM (MYT)
Ref ID: 20260917RPPEMYKL010HRB80620236
Amount
RM4,000.00
Successful
Transfer to
DARMA MOTOR SDN BHD
21430700004956
RHB Bank Berhad
Transaction date
17 Sep 2026, 06:24PM
Recipient reference
PaymentModenasElit
This receipt is computer generated and no signature is required.`;

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

  it('finds the reference no. and amount when a mobile "share receipt" screen puts labels above their values', () => {
    const { parsed } = parseSlip(MOBILE_SHARE_RECEIPT_SLIP);

    expect(parsed.referenceNo.value).toBe('960386438M');
    expect(parsed.referenceNo.confidence).toBeGreaterThanOrEqual(80);
    expect(parsed.amount.value).toBe(1500);
    expect(parsed.amount.confidence).toBeGreaterThanOrEqual(80);
    expect(parsed.bank.value).toBe('Maybank');
    // OCR never captured the small gray timestamp text at all here - it's
    // genuinely absent from the input, so parsing correctly leaves these
    // blank rather than inventing a value from unrelated numbers elsewhere
    // (e.g. the phone status bar's "12:42" clock, also picked up by OCR).
    expect(parsed.date.value).toBeNull();
    expect(parsed.time.value).toBeNull();
  });

  it('finds the reference no. when another field sits between the label and its value (PaddleOCR reading order)', () => {
    const { parsed } = parseSlip(PADDLEOCR_MOBILE_SHARE_RECEIPT_SLIP);

    expect(parsed.referenceNo.value).toBe('960386438M');
    expect(parsed.referenceNo.confidence).toBeGreaterThanOrEqual(80);
    // Must not fall through to "Recipient reference" / the payer's name.
    expect(parsed.referenceNo.value).not.toContain('Cyrus');
    expect(parsed.date.value).toBe('31-07-2026');
    expect(parsed.time.value).toBe('12:42:00 PM');
    expect(parsed.amount.value).toBe(1500);
    expect(parsed.bank.value).toBe('Maybank');
  });

  it('parses a date/time even when OCR collapses its spaces, and does not mistake it for the reference no.', () => {
    const { parsed } = parseSlip(PADDLEOCR_NO_SPACE_DATE_SLIP);

    expect(parsed.date.value).toBe('31-07-2026');
    expect(parsed.time.value).toBe('12:42:00 PM');
    expect(parsed.referenceNo.value).toBe('960386438M');
  });

  it('picks the issuing bank in the header over a different bank named later in the text', () => {
    const { parsed } = parseSlip(AEON_BANK_SLIP);

    expect(parsed.bank.value).toBe('AEON Bank');
    expect(parsed.date.value).toBe('17-09-2026');
    expect(parsed.time.value).toBe('06:24:00 PM');
    expect(parsed.amount.value).toBe(4000);
    expect(parsed.referenceNo.value).toBe('20260917RPPEMYKL010HRB80620236');
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
