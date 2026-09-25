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

// Actual OCR output (captured verbatim via "View text") from a real photo
// of a printed AEON Bank receipt lying on top of other papers with
// handwritten notes - lots of surrounding noise from the background, and
// AEON's stylized circular-icon "A" was dropped entirely, reading the
// header as "EONBank" with no leading "A" and no space before "Bank".
const AEON_BANK_SLIP_NOISY_PHOTO = `INGI  AL
上Ahe
LTPN
2. Goe
20 8
Notes
C0R-00003570
payment for
modenes elit
EONBank
ikos white
17 Sep 2026, 06:24PM (MYT)
RefID:20260917RPPEMYKL010HRB80620236
Amount
RM4,000.00
Successful
Transfer to
DARMA MOTOR SDN BHD
O
156
H ad
ra
服  P
家e
PaymentModenasElit
This receipt is computer generated and no signature is
required.`;

// Real Tesseract output (captured verbatim, SPARSE_TEXT mode - note the
// blank line after every fragment) from a Setel DuitNow QR payment
// screenshot. No "Amount"/"Total" label exists on this slip at all, just
// "RM18.50" standing alone - so parseAmount falls back to the first
// currency-prefixed number in the whole text, found via a regex that
// allowed \s (which matches newlines) inside a money token. That let the
// match greedily continue across the blank line into "ONEPLUSONENANYANG
// COFFEE" on the next fragment, absorbing its leading "O" (one of the OCR-
// misread letters this regex maps to a digit) as "18.50\n\nO" -> 18500
// instead of 18.5.
const SETEL_SCREENSHOT_SLIP = `Payment successful

RM18.50

ONEPLUSONENANYANGCOFFEE

Transaction time

21 Sep 2026, 09:30

Transaction ID

6AB088C9678A24E1BD06DE

05`;

// Actual OCR output (captured verbatim via "View text") from a real Shopee
// SPayLater instalment receipt screenshot - confirms the cross-line fix
// above holds on a second real slip with the same "unlabeled currency-
// prefixed amount, blank line before the next fragment" shape ("rm3,499.83"
// lowercase, no "Amount"/"Total" keyword line anywhere on this slip either).
// Also confirms the "SPayLater" -> ShopeePay alias holds against the real
// shape OCR actually produces here: split at the capital "L" as "SPayL
// ater", not the clean "SPayLater" used when first adding the alias.
const SHOPEE_INSTALMENT_SLIP = `< Transaction Details

rm3,499.83

Order Amount

Paid by

SPayL ater Instalment

Period

24

Created Time

27 Jul 2026 19:03

Products

In Store - DARMA MOTOR SDN

BHD

Pay To

DARMA MOTOR SDN BHD

Transaction ID

2192975866927343627

Order ID

ATBVrZMj15NFN

Original Receipt

Instalment Details`;

// Real Tesseract output (captured verbatim via native Tesseract against the
// app's exact preprocessing, not hand-typed) from a real Maybank "Share
// Receipt" screenshot. Unlike the older MOBILE_SHARE_RECEIPT_SLIP/
// PADDLEOCR_MOBILE_SHARE_RECEIPT_SLIP fixtures above (written tight, no
// blank lines - accurate for PaddleOCR's output shape, but PaddleOCR has
// since been removed from the app entirely), Tesseract's SPARSE_TEXT mode
// puts a blank line after every fragment. That pushed "960386438M" 4 raw
// lines past its "Reference ID" label instead of 2, one line further than
// parseReferenceNo's lookaround window counted (it counted blank lines
// toward the limit instead of skipping them) - reference no. came back
// null even though the value was right there a few fragments down.
const MAYBANK_SHARE_RECEIPT_TESSERACT_SLIP = `Share Receipt

Maybank

Third Party Transfer

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

RM 1500.00`;

// Actual OCR output (captured verbatim via "View text") from a real Citi
// bank "Payment Advice" - a fixed-width-font document whose "Label  :
// value" alignment padding gets split into extra fragments by Tesseract:
// "Invoice Amount" is followed by two lone ":" fragments (each on its own
// blank-padded line) before the real "3,300.00" value. parseAmount's old
// next-line check only looked at the single nearest non-blank line
// (nextNonEmptyLine) - that line was just ":", contained no usable number,
// and the search gave up right there instead of continuing to the next
// fragment, so amount came back missing even though the value was two
// fragments further down.
const CITI_PAYMENT_ADVICE_SLIP = `DATE

:

:

28-Aug-26

Bank Reference

:

QM8SC1658HY00128

Invoice Amount

:

:

3,300.00

Currency

:

MYR

Credit Date

:

28-Aug-26

Payment Details

:

DIV-003006`;

// Actual OCR output (captured verbatim via "View text") from a real DuitNow
// transfer receipt photo. Tesseract dropped the leading character of nearly
// every label on this particular photo ("Transaction" -> "ransaction",
// "Product" -> "roduct", "Reference No" -> "eference No", ...) - critically,
// "Reference No" losing its "R" means it no longer matches a keyword regex
// that requires "reference" to start intact, so the parser skipped right
// past the real field and matched "Service Reference No" (OCR'd as "rvice
// Reference No" - only "Se" dropped, but "Reference No" itself sits further
// into that line so it survives untouched) instead, returning the wrong
// number entirely.
const DUITNOW_DROPPED_LEADING_CHAR_SLIP = `Transaction Details

roduct Type

DuitNow Transfer

eference No

26090703838771

rvice Reference No

444831

proval Status

Success

m Account

3234676925 / JH JAYA MOTORSPORT SC

nsfer Mode

New Transfer

pient Bank

Hong Leong Bank Berhad

pient Reference

DIV-003535

ount

MYR 10,678.00

Payment Date

07-Sep-2026`;

// Real Tesseract output (captured verbatim) from a DuitNow transfer receipt
// with a label-left/value-right table layout. Tesseract's SPARSE_TEXT
// reading order puts several values *before* their own label - the date
// value sits right after the previous field's label ("SMS Fee") and before
// its own ("Payment Date"), which a forward-only lookahead from the "Date"
// keyword would miss. The date itself is also hyphen-separated
// ("07-Sep-2026"), not space-separated like "12 Sep 2026".
const DUITNOW_TABLE_LAYOUT_SLIP = `Transaction Approval
Transaction Details
Product Type
DuitNow Transfer
Reference No
2609070383287326
Service Reference No
021662
Success
Approval Status
3206944911 / MENG SOON AUTO SDN. BHD
From Account
New Transfer
Transfer Mode
Recipient's DuitNow ID Type
Account Number
Recipient Bank
Hong Leong Bank Berhad
Fund Transfer
Transfer Type
15400016345/DARMA MOTOR SDN BHD
Recipient's DuitNow ID/Account
No.
DIV-003530
Recipient Reference
MYR 10,678.00
Amount
MYR 0.00
Fee
MYR 0.00
Total Fee Charges
MYR 0.00
SMS Fee
07-Sep-2026
Payment Date`;

// Real Tesseract output (captured verbatim via "View text") from a Public
// Bank FPX payment receipt. The issuing bank's own branding ("PUBLIC BANK")
// only appears in the footer logo, at the very end of the page, while
// "Seller Description: ALLIANCE BANK MALAYSIA BERHAD" (the FPX merchant's
// settlement bank, not the payer's own bank) sits mid-page, well before it -
// naive earliest-match-wins picked Alliance Bank.
const PUBLIC_BANK_FPX_SLIP = `RM 4,376.66

Transfer Method

FPX

Reference No.

779830

Date & Time

28/08/2026 12:09:24 PM

From Account

***#**3623 (Savings)

Transaction ID

2608281208140046

Serial Number

Seller ID

SE00087422

Seller Description

ALLIANCE BANK

MALAYSIA BERHAD

Seller Order Number

42367 9ii7e90450VCCFP

X145006960320045071

Transaction Status

Successful

Reason

BANK FOR THE PEOPLE

PUBLIC BANK

BUBLIC ISLAMIC BANK.

Public Bank Berhad 196501000672 (6463-H)

Public Islamic Bank Berhad 197301001433 (14328-V)`;

// Real Tesseract.js output, captured from the live app in a browser for a
// Hong Leong "ConnectFirst" debit advice. The slip prints the same date
// twice - the document "Date: 01/09/2026" and "Value Date: 01-09-2026" - and
// in-browser OCR misread the first as 01/08/2026 but got "Value Date" right.
const HLB_DEBIT_ADVICE_SLIP = `[lf 3 HongLeong Bank p> HongLeong Islamic Bank | IEE

connectFirst

DEBIT ADVICE

Date

01/08/2026

Account No.

HOOKXKE046

Dear SirMadam,

Account Name

TME MOTORSPORTS SDN

Your Account has been debited for the following transaction

Transaction Details

Transaction Reference No.

: C753010926164136

Payment Type

+ Payment to 3rd Party Account

Value Date

: 01-09-2026

Beneficiary Name

: DARMA MOTOR SDN BHD

XOXXXXE345

Amount (MYR)

: 25,872.00

Beneficiary Account No.

Service Charge (MYR)

$0.00

Beneficiary Bank

HLBB,HLBB`;

// Real Tesseract.js output, captured from the live app in a browser, for a
// Citi "Payment Advice" in a thin light-gray typewriter font. Citi's name is
// only in its logo (unreadable as text); the only bank text left is the
// beneficiary's SWIFT code "HLBBMYKL", whose "Beneficiary Bank" label OCR
// broke apart ("Bene" / "iary Bank").
const CITI_PAYMENT_ADVICE_BROWSER_SLIP = `DATE

28-Aug-26

Page

1

To

Darma Motor Sdn Bhd

be made to your account on behalf of IMOTORBIKE WORLD SDN

Bank Reference

QOM88C1658HYO!

Transaction Reference

260828 00358

Bene

iary Bank

HLBBMYKL

DuitNow

ID/Account Number

15400016345

Inv

ice Amount

3,300

.00

00

Currency

MYR

Cre

Date

28-Aug-26

request of the bank of client and purports to set out certain details of the transaction our bank was instructed to`;

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

  it('corrects common OCR digit confusions in the amount, and does not flag a missing time as needs review', () => {
    const { parsed } = parseSlip(PUBLIC_BANK_SLIP_MISSING_TIME);

    // "l,2S0.00" -> "1,250.00"
    expect(parsed.amount.value).toBe(1250);
    expect(parsed.amount.confidence).toBeLessThan(95); // OCR fix lowers confidence
    expect(parsed.time.value).toBeNull();
    expect(parsed.time.confidence).toBe(0);
    expect(parsed.bank.value).toBe('Public Bank');
    // Time is treated as optional (shown as "N/A", not a review-worthy gap) -
    // this slip's other required fields are all present and confident, so
    // an absent time alone shouldn't block "ok" status.
    expect(computeStatus(parsed)).toBe('ok');
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

  it('recognizes AEON Bank even when OCR drops the logo\'s stylized "A", amid real background noise', () => {
    const { parsed } = parseSlip(AEON_BANK_SLIP_NOISY_PHOTO);

    expect(parsed.bank.value).toBe('AEON Bank');
    expect(parsed.date.value).toBe('17-09-2026');
    expect(parsed.time.value).toBe('06:24:00 PM');
    expect(parsed.amount.value).toBe(4000);
    expect(parsed.referenceNo.value).toBe('20260917RPPEMYKL010HRB80620236');
  });

  it('does not let a bare unlabeled amount greedily absorb a letter from the next unrelated line', () => {
    const { parsed } = parseSlip(SETEL_SCREENSHOT_SLIP);

    expect(parsed.amount.value).toBe(18.5);
    expect(parsed.date.value).toBe('21-09-2026');
    expect(parsed.time.value).toBe('09:30:00 AM');
  });

  it('parses an unlabeled lowercase-prefixed amount on a second real slip shape', () => {
    const { parsed } = parseSlip(SHOPEE_INSTALMENT_SLIP);

    // SPayLater is a ShopeePay product - its receipts never print
    // "Shopee"/"ShopeePay" anywhere, only "SPayLater".
    expect(parsed.bank.value).toBe('ShopeePay');
    expect(parsed.amount.value).toBe(3499.83);
    expect(parsed.date.value).toBe('27-07-2026');
    expect(parsed.referenceNo.value).toBe('2192975866927343627');
  });

  it('finds an amount past intervening lone ":" fragments, not just the single nearest non-blank line', () => {
    const { parsed } = parseSlip(CITI_PAYMENT_ADVICE_SLIP);

    expect(parsed.amount.value).toBe(3300);
    expect(parsed.date.value).toBe('28-08-2026');
    expect(parsed.referenceNo.value).toBe('QM8SC1658HY00128');
  });

  it('finds a reference no. that sits several blank-line-separated fragments past its label', () => {
    const { parsed } = parseSlip(MAYBANK_SHARE_RECEIPT_TESSERACT_SLIP);

    expect(parsed.referenceNo.value).toBe('960386438M');
    expect(parsed.date.value).toBe('31-07-2026');
    expect(parsed.amount.value).toBe(1500);
    expect(parsed.bank.value).toBe('Maybank');
  });

  it('matches "Reference No" even with its leading letter dropped, not "Service Reference No" instead', () => {
    const { parsed } = parseSlip(DUITNOW_DROPPED_LEADING_CHAR_SLIP);

    expect(parsed.referenceNo.value).toBe('26090703838771');
    expect(parsed.date.value).toBe('07-09-2026');
    expect(parsed.amount.value).toBe(10678);
  });

  it('parses a hyphenated "07-Sep-2026" date even when it sits before its own label', () => {
    const { parsed } = parseSlip(DUITNOW_TABLE_LAYOUT_SLIP);

    expect(parsed.date.value).toBe('07-09-2026');
    expect(parsed.amount.value).toBe(10678);
    expect(parsed.referenceNo.value).toBe('2609070383287326');
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

  it('resolves an ambiguous numeric date as day-first (Malaysian convention)', () => {
    const { parsed } = parseSlip('Date: 03/04/2026\nAmount: RM10.00');
    expect(parsed.date.value).toBe('03-04-2026');
  });

  it('recognizes digital wallet/e-money apps as valid bank sources, not just banks', () => {
    const cases: Array<[string, string]> = [
      ["Touch 'n Go eWallet\nPayment Successful\nDate: 12/09/2026\nAmount: RM5.00", "Touch 'n Go eWallet"],
      ['ShopeePay\nPayment Receipt\nDate: 12/09/2026\nAmount: RM20.00', 'ShopeePay'],
      ['GrabPay\nTransaction Successful\nDate: 12/09/2026\nAmount: RM8.50', 'GrabPay'],
      ['Boost eWallet\nPayment Successful\nDate: 12/09/2026\nAmount: RM15.00', 'Boost'],
      ['Setel\nPayment Successful\nDate: 12/09/2026\nAmount: RM50.00', 'Setel'],
      ['BigPay\nTransfer Successful\nDate: 12/09/2026\nAmount: RM100.00', 'BigPay'],
    ];

    for (const [text, expectedBank] of cases) {
      const { parsed } = parseSlip(text);
      expect(parsed.bank.value).toBe(expectedBank);
    }
  });

  it("doesn't confuse the Boost e-wallet with Boost Bank (the digital bank)", () => {
    const { parsed } = parseSlip('Boost Bank\nTransfer Receipt\nDate: 12/09/2026\nAmount: RM30.00');
    expect(parsed.bank.value).toBe('Boost Bank');
  });

  it('picks the issuing bank over the counterparty bank named under "Seller Description" on an FPX receipt', () => {
    const { parsed } = parseSlip(PUBLIC_BANK_FPX_SLIP);
    expect(parsed.bank.value).toBe('Public Bank');
    expect(parsed.amount.value).toBe(4376.66);
    expect(parsed.referenceNo.value).toBe('779830');
  });

  // Synthetic (not from a real captured photo) - found via a self-run stress
  // test across many amount/date/reference/bank shapes after being asked to
  // hunt for cases where the parsed value comes out at the wrong order of
  // magnitude. A trailing decimal point with only ONE digit after it (OCR
  // dropping the final "0" off ".50", producing ".5") was being swept into
  // the integer part instead of treated as a decimal, e.g. "1000.5" came out
  // as 10005 - ten times too large - instead of 1000.5.
  it('does not inflate an amount 10x when OCR drops the trailing zero off a decimal (".50" -> ".5")', () => {
    const { parsed } = parseSlip('Amount: RM1000.5');
    expect(parsed.amount.value).toBe(1000.5);
  });

  // Synthetic - same stress test. "Service Reference No" is already a known
  // decoy field (see the two real DuitNow fixtures above), but the existing
  // fix only worked because the real "Reference No" happened to sit earlier
  // in the text in both of those cases - order, not content, was doing the
  // work. A receipt where "Service Reference No" appears FIRST would have
  // matched the decoy instead.
  it('prefers "Value Date" over a misread document "Date", and flags the disagreement for review', () => {
    const { parsed } = parseSlip(HLB_DEBIT_ADVICE_SLIP);
    expect(parsed.date.value).toBe('01-09-2026');
    expect(parsed.date.confidence).toBeLessThan(80);
    expect(parsed.amount.value).toBe(25872);
    expect(parsed.referenceNo.value).toBe('C753010926164136');
    expect(parsed.bank.value).toBe('Hong Leong Bank');
  });

  it('recognises a Citi payment advice from its wording, not the beneficiary SWIFT code', () => {
    const { parsed } = parseSlip(CITI_PAYMENT_ADVICE_BROWSER_SLIP);
    expect(parsed.bank.value).toBe('Citibank');
    expect(parsed.date.value).toBe('28-08-2026');
    expect(parsed.amount.value).toBe(3300);
  });

  it("reports Unknown rather than the beneficiary's bank when a SWIFT code is the only bank text", () => {
    const { parsed } = parseSlip('Payment Advice\nDate: 28-Aug-26\nBank\nHLBBMYKL\nAmount: RM3,300.00');
    expect(parsed.bank.value).toBe('Unknown');
  });

  it('never matches "Service Reference No" as the reference, even when it appears before the real one', () => {
    const { parsed } = parseSlip('Service Reference No: WRONG111\nReference No: RIGHT222');
    expect(parsed.referenceNo.value).toBe('RIGHT222');
  });
});
