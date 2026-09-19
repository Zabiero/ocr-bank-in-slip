import type { Bank } from '../types';

/**
 * Known Malaysian banks and OCR-friendly aliases (short codes, common
 * misspellings, header text seen on real slips). To add a bank, append an
 * entry here — see README.md "Adding a new bank" for details. Order matters
 * only in that the first, most-specific match wins, so keep longer/more
 * specific aliases before generic ones within a bank's own list.
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
];

export const UNKNOWN_BANK = 'Unknown';

/**
 * Detects a bank name from free-form OCR text by matching against the
 * configured alias list (case-insensitive substring match). Returns a
 * confidence score: 95 for a match, 0 (with UNKNOWN_BANK) when nothing
 * matches — the caller flags 0-confidence fields for review rather than
 * guessing a bank.
 */
export function detectBank(
  text: string,
  banks: Bank[] = BANKS,
): { name: string; confidence: number; raw?: string } {
  const lower = text.toLowerCase();
  let best: { name: string; alias: string } | null = null;

  for (const bank of banks) {
    for (const alias of bank.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        if (!best || alias.length > best.alias.length) {
          best = { name: bank.name, alias };
        }
      }
    }
  }

  if (best) {
    return { name: best.name, confidence: 95, raw: best.alias };
  }
  return { name: UNKNOWN_BANK, confidence: 0 };
}
