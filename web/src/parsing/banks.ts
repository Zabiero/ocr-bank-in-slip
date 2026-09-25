import type { Bank } from '../types';

/**
 * Known Malaysian banks, digital banks and e-wallet/digital-payment apps
 * (a "Bank" entry here is really "who issued this receipt" - a slip from
 * Touch 'n Go eWallet or GrabPay is just as valid a source as one from
 * Maybank), plus OCR-friendly aliases (short codes, common misspellings,
 * header text seen on real slips/screenshots). To add one, append an entry
 * here — see README.md "Adding a new bank" for details. Order matters only
 * in that the first, most-specific match wins, so keep longer/more specific
 * aliases before generic ones within an entry's own list.
 */
export const BANKS: Bank[] = [
  {
    name: 'Maybank',
    aliases: ['maybank', 'malayan banking', 'mbb', 'maybank2u', 'mae by maybank2u'],
  },
  {
    name: 'CIMB Bank',
    aliases: ['cimb bank', 'cimb clicks', 'cimb'],
  },
  {
    name: 'Public Bank',
    aliases: ['public bank', 'pbe bank', 'pbb', 'pbebank'],
  },
  {
    name: 'RHB Bank',
    aliases: ['rhb bank', 'rhb islamic', 'rhb'],
  },
  {
    name: 'Hong Leong Bank',
    // "HongLeong" as one word is how its logo/header prints (e.g. "HongLeong
    // Bank" on a ConnectFirst debit advice), which "hong leong bank" misses.
    aliases: ['hong leong bank', 'hongleong', 'hlb', 'hong leong connect', 'connectfirst'],
  },
  {
    name: 'Bank Islam',
    aliases: ['bank islam malaysia', 'bank islam', 'bimb'],
  },
  {
    name: 'AmBank',
    aliases: ['ambank', 'am bank', 'amonline', 'ambank islamic'],
  },
  {
    name: 'BSN',
    aliases: ['bank simpanan nasional', 'bsn'],
  },
  {
    name: 'Bank Rakyat',
    aliases: ['bank rakyat', 'bkrm'],
  },
  {
    name: 'Alliance Bank',
    aliases: ['alliance bank', 'alliance online'],
  },
  {
    name: 'Affin Bank',
    aliases: ['affin bank', 'affin islamic'],
  },
  {
    name: 'UOB',
    aliases: ['united overseas bank', 'uob'],
  },
  {
    name: 'OCBC Bank',
    aliases: ['ocbc bank', 'ocbc'],
  },
  {
    name: 'HSBC',
    aliases: ['hsbc bank malaysia', 'hsbc amanah', 'hsbc'],
  },
  {
    name: 'Standard Chartered',
    aliases: ['standard chartered bank', 'standard chartered', 'sc mobile'],
  },
  {
    name: 'MBSB Bank',
    aliases: ['mbsb bank', 'mbsb'],
  },
  {
    name: 'Bank Muamalat',
    aliases: ['bank muamalat malaysia', 'bank muamalat'],
  },
  {
    name: 'AEON Bank',
    // AEON's logo draws the "A" as a circular icon rather than a normal
    // letter, which OCR frequently drops entirely - reading the header as
    // "EONBank"/"EON Bank" with no leading "A" and often no space either.
    aliases: ['aeon bank (m) berhad', 'aeon bank', 'eonbank', 'eon bank'],
  },
  {
    name: 'Kuwait Finance House',
    aliases: ['kuwait finance house malaysia', 'kuwait finance house', 'kfh'],
  },
  {
    name: 'Al Rajhi Bank',
    aliases: ['al rajhi banking', 'al rajhi bank', 'al-rajhi'],
  },
  {
    name: 'Agrobank',
    aliases: ['bank pertanian malaysia', 'agrobank'],
  },
  {
    name: 'Citibank',
    aliases: ['citibank berhad', 'citibank', 'citi bank'],
    // Citi's corporate "Payment Advice" shows its name only as a logo, which
    // OCR can't read. These two phrases from its body and disclaimer survive
    // OCR intact and together are specific to that document.
    fingerprint: ['made to your account on behalf of', 'purports to set out certain details of the transaction'],
  },
  {
    name: 'Bank of China (Malaysia)',
    aliases: ['bank of china (malaysia)', 'bank of china malaysia'],
  },
  // Malaysia's five BNM-licensed digital banks (launched 2022-2025).
  {
    name: 'GXBank',
    aliases: ['gxbank', 'gx bank'],
  },
  {
    name: 'Boost Bank',
    aliases: ['boost bank'],
  },
  {
    name: 'KAF Digital Bank',
    aliases: ['kaf digital bank'],
  },
  {
    name: 'YTL Digital Bank',
    aliases: ['ytl digital bank', 'ryt bank'],
  },
  // Digital wallets / e-money apps commonly used for peer-to-peer and
  // merchant payments in Malaysia - their receipts/screenshots look nothing
  // like a bank's, but are just as common a source for this app.
  {
    name: "Touch 'n Go eWallet",
    aliases: ["touch 'n go ewallet", 'touch n go ewallet', 'tng ewallet', 'tng digital', 'tng'],
  },
  {
    name: 'ShopeePay',
    // SPayLater (Shopee's "buy now, pay later" instalment product) receipts
    // never actually print "Shopee"/"ShopeePay" anywhere - "SPayLater" is
    // the only brand text OCR ever sees, so it needs its own alias here.
    // Confirmed on a real screenshot: OCR splits it at the capital "L" as
    // "SPayL ater" (a stray space mid-word), so that exact shape needs its
    // own alias too - a plain "spaylater" substring check won't match it.
    aliases: ['shopeepay', 'shopee pay', 'spaylater', 'spayl ater'],
  },
  {
    name: 'GrabPay',
    aliases: ['grabpay', 'grab pay', 'grab wallet'],
  },
  {
    name: 'Boost',
    // Distinct from "Boost Bank" above (the BNM-licensed digital bank) -
    // this is the older Boost e-wallet app from the same group.
    aliases: ['boost ewallet', 'boost e-wallet', 'boost'],
  },
  {
    name: 'Setel',
    aliases: ['setel'],
  },
  {
    name: 'BigPay',
    aliases: ['bigpay', 'big pay'],
  },
];

export const UNKNOWN_BANK = 'Unknown';

/**
 * Labels that introduce the *other* party's bank, not the receipt's own
 * issuer - e.g. an FPX payment's "Seller Description" (the merchant's
 * settlement bank) or a transfer's "Beneficiary"/"Transfer to" section (the
 * recipient's bank). A bank name found right after one of these must not
 * outrank the issuing bank's own name/logo just because it happens to sit
 * earlier in the page than a footer logo (confirmed on a real Public Bank
 * FPX receipt: "Seller Description: ALLIANCE BANK MALAYSIA BERHAD" appears
 * mid-page, while "PUBLIC BANK" only appears in the footer branding at the
 * very end - naive earliest-match-wins picked Alliance Bank).
 */
const COUNTERPARTY_LABEL = /\b(seller|beneficiary|recipient|receiver|payee|transfer to|kepada|penerima)\b/i;
const COUNTERPARTY_LOOKBACK_LINES = 4;

interface BankMatch {
  name: string;
  alias: string;
  index: number;
}

function isNearCounterpartyLabel(lines: string[], lineSpans: Array<{ start: number; end: number }>, matchIndex: number): boolean {
  const lineIdx = lineSpans.findIndex(({ start, end }) => matchIndex >= start && matchIndex < end);
  if (lineIdx === -1) return false;
  if (COUNTERPARTY_LABEL.test(lines[lineIdx])) return true;

  for (let j = lineIdx - 1, seen = 0; j >= 0 && seen < COUNTERPARTY_LOOKBACK_LINES; j--) {
    if (lines[j].trim() === '') continue;
    seen++;
    if (COUNTERPARTY_LABEL.test(lines[j])) return true;
  }
  return false;
}

/**
 * A Malaysian SWIFT/BIC code (e.g. "HLBBMYKL": 4-letter bank code, "MY",
 * 2-char location, optional 3-char branch). Slips use these for the *other*
 * party's bank ("Beneficiary Bank : HLBBMYKL"), never to identify their own
 * issuer - and a bank alias like "hlb" matching inside one says nothing
 * about who issued the slip. Confirmed on a real Citi payment advice: OCR
 * broke its "Beneficiary Bank" label apart ("Bene" / "iary Bank"), so only
 * this shape could tell that "HLBBMYKL" was the recipient's bank.
 */
const MALAYSIAN_SWIFT_CODE = /^[A-Z]{4}MY[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

function isInsideSwiftCode(text: string, matchIndex: number): boolean {
  let start = matchIndex;
  while (start > 0 && /[A-Za-z0-9]/.test(text[start - 1])) start--;
  let end = matchIndex;
  while (end < text.length && /[A-Za-z0-9]/.test(text[end])) end++;
  return MALAYSIAN_SWIFT_CODE.test(text.slice(start, end));
}

/** Earliest match wins; ties broken by the longer (more specific) alias. */
function pickBest(matches: BankMatch[]): BankMatch | null {
  let best: BankMatch | null = null;
  for (const m of matches) {
    const isBetter = !best || m.index < best.index || (m.index === best.index && m.alias.length > best.alias.length);
    if (isBetter) best = m;
  }
  return best;
}

/**
 * Detects a bank name from free-form OCR text by matching against the
 * configured alias list (case-insensitive substring match). Returns a
 * confidence score: 95 for a match, 0 (with UNKNOWN_BANK) when nothing
 * matches — the caller flags 0-confidence fields for review rather than
 * guessing a bank.
 *
 * Prefers whichever match occurs earliest in the text over the longest
 * alias, since the issuing bank's own name/logo is almost always near the
 * top of a receipt, while a different bank's name can legitimately appear
 * further down (e.g. the recipient's bank in a "Transfer to ... RHB Bank
 * Berhad" section of a transfer receipt) - that later match must not win.
 * Matches found right after a counterparty label (see COUNTERPARTY_LABEL)
 * or inside a SWIFT code are never used, since they name the *other*
 * party's bank regardless of where on the page they happen to sit.
 */
export function detectBank(
  text: string,
  banks: Bank[] = BANKS,
): { name: string; confidence: number; raw?: string } {
  const lower = text.toLowerCase();
  const lines = text.split(/\r?\n/);
  const lineSpans: Array<{ start: number; end: number }> = [];
  {
    let cursor = 0;
    for (const line of lines) {
      lineSpans.push({ start: cursor, end: cursor + line.length });
      cursor += line.length + 1;
    }
  }

  const ownMatches: BankMatch[] = [];
  const counterpartyMatches: BankMatch[] = [];

  for (const bank of banks) {
    for (const alias of bank.aliases) {
      const index = lower.indexOf(alias.toLowerCase());
      if (index === -1) continue;
      const match: BankMatch = { name: bank.name, alias, index };
      if (isNearCounterpartyLabel(lines, lineSpans, index) || isInsideSwiftCode(text, index)) {
        counterpartyMatches.push(match);
      } else {
        ownMatches.push(match);
      }
    }
  }

  const best = pickBest(ownMatches);
  if (best) {
    return { name: best.name, confidence: 95, raw: best.alias };
  }

  // No name printed as text - try recognising the document's standard
  // wording instead. Whitespace is collapsed since OCR splits lines freely.
  const flat = lower.replace(/\s+/g, ' ');
  const byWording = banks.find((b) => b.fingerprint?.length && b.fingerprint.every((phrase) => flat.includes(phrase)));
  if (byWording) {
    return { name: byWording.name, confidence: 85, raw: 'recognised from document wording' };
  }
  // Only the other party's bank was found - that's not who issued the slip,
  // so report Unknown (flagged for review) rather than a confident wrong
  // answer. Confirmed on a real Citi payment advice whose only bank text was
  // the beneficiary's SWIFT code; it showed "Hong Leong Bank" as the issuer.
  return { name: UNKNOWN_BANK, confidence: 0, raw: pickBest(counterpartyMatches)?.alias };
}
