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
    aliases: ['hong leong bank', 'hlb', 'hong leong connect'],
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
    aliases: ['shopeepay', 'shopee pay'],
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
 */
export function detectBank(
  text: string,
  banks: Bank[] = BANKS,
): { name: string; confidence: number; raw?: string } {
  const lower = text.toLowerCase();
  let best: { name: string; alias: string; index: number } | null = null;

  for (const bank of banks) {
    for (const alias of bank.aliases) {
      const index = lower.indexOf(alias.toLowerCase());
      if (index === -1) continue;
      const isBetter = !best || index < best.index || (index === best.index && alias.length > best.alias.length);
      if (isBetter) {
        best = { name: bank.name, alias, index };
      }
    }
  }

  if (best) {
    return { name: best.name, confidence: 95, raw: best.alias };
  }
  return { name: UNKNOWN_BANK, confidence: 0 };
}
