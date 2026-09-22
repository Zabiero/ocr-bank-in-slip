import type { Bank, DateAmbiguityMode, ParsedSlip } from '../types';
import { CONFIDENCE_WARN_THRESHOLD } from '../types';
import { BANKS, detectBank } from './banks';
import { parseDate } from './dateParsing';
import { parseTime } from './timeParsing';
import { parseAmount } from './amountParsing';
import { parseReferenceNo } from './referenceParsing';
import { maskAccountNumbers } from './maskAccountNumbers';

export interface ParseSlipOptions {
  dateAmbiguityMode?: DateAmbiguityMode;
  banks?: Bank[];
}

/**
 * Pure text -> structured-fields parser. Deliberately has no knowledge of
 * OCR/images so it can be unit tested against plain strings and swapped
 * independently of whichever OCR engine produced the text.
 */
export function parseSlip(rawText: string, options: ParseSlipOptions = {}): { parsed: ParsedSlip; maskedText: string } {
  const dateAmbiguityMode = options.dateAmbiguityMode ?? 'day-first';
  const banks = options.banks ?? BANKS;

  const { maskedText, masked } = maskAccountNumbers(rawText);

  const date = parseDate(maskedText, dateAmbiguityMode);
  const time = parseTime(maskedText);
  const { amount, currency } = parseAmount(maskedText);
  const referenceNo = parseReferenceNo(maskedText);
  const bankResult = detectBank(maskedText, banks);

  const parsed: ParsedSlip = {
    date,
    time,
    amount,
    currency,
    referenceNo,
    bank: { value: bankResult.name, confidence: bankResult.confidence, raw: bankResult.raw },
    maskedAccountNumbers: masked,
  };

  return { parsed, maskedText };
}

/**
 * A slip is "OK" only when every required field was found with high
 * confidence. Time is deliberately excluded: plenty of valid slips (a
 * formal bank payment advice, for instance) only ever state a date, with
 * no time of day anywhere on the document - treating that as a review-
 * worthy problem the way a genuinely missing amount or reference no. would
 * be produces a false "needs review" on an otherwise perfectly good slip.
 * If time *was* found, it's still shown and still confidence-checked like
 * any other field - only its absence is treated as fine.
 */
export function computeStatus(parsed: ParsedSlip): 'ok' | 'needs_review' {
  const requiredFields = [parsed.date, parsed.amount, parsed.referenceNo, parsed.bank];
  const allPresent = requiredFields.every((f) => f.value !== null && f.value !== undefined);
  const allConfident = requiredFields.every((f) => f.confidence >= CONFIDENCE_WARN_THRESHOLD);
  const timeOkIfPresent = parsed.time.value === null || parsed.time.confidence >= CONFIDENCE_WARN_THRESHOLD;
  return allPresent && allConfident && timeOkIfPresent ? 'ok' : 'needs_review';
}

export function emptyParsedSlip(): ParsedSlip {
  return {
    date: { value: null, confidence: 0 },
    time: { value: null, confidence: 0 },
    amount: { value: null, confidence: 0 },
    currency: { value: null, confidence: 0 },
    referenceNo: { value: null, confidence: 0 },
    bank: { value: null, confidence: 0 },
    maskedAccountNumbers: [],
  };
}

export type EditableSlipField = 'date' | 'time' | 'amount' | 'referenceNo' | 'bank';

/** Applies a manual correction from the results table. A human-entered value
 * is always treated as fully confident (100) since it is no longer a guess. */
export function editSlipField(parsed: ParsedSlip, field: EditableSlipField, rawValue: string): ParsedSlip {
  const trimmed = rawValue.trim();

  if (field === 'amount') {
    const numeric = Number(trimmed.replace(/,/g, ''));
    const value = trimmed === '' || !Number.isFinite(numeric) ? null : Math.round(numeric * 100) / 100;
    return { ...parsed, amount: { value, confidence: value == null ? 0 : 100 } };
  }

  const value = trimmed === '' ? null : trimmed;
  return { ...parsed, [field]: { value, confidence: value == null ? 0 : 100 } };
}
