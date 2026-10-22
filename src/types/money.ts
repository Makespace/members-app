import * as t from 'io-ts';

// Money is held as a whole number of pence everywhere (events, read model,
// classification) so sums never pick up floating point drift. Pounds only
// appear at the edges: what a member types into a form, and what a page shows.

const POUNDS_PATTERN = /^\d+(\.\d{1,2})?$/;

const AMOUNT_HINT = 'Expected an amount in pounds, e.g. 630.00';

const parsePoundsToPence = (input: string): number | null => {
  const cleaned = input.trim().replace(/^£/, '').replace(/,/g, '').trim();
  if (!POUNDS_PATTERN.test(cleaned)) {
    return null;
  }
  const [pounds, fraction = ''] = cleaned.split('.');
  const pence = Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(pence) ? pence : null;
};

const isPence = (u: unknown): u is number =>
  typeof u === 'number' && Number.isSafeInteger(u) && u >= 0;

// A sum of money typed in pounds ("630", "630.50", "£1,000") decoded to whole
// pence. Zero is allowed here; PositivePenceFromPoundsString refuses it.
export const PenceFromPoundsString = new t.Type<number, string, unknown>(
  'PenceFromPoundsString',
  isPence,
  (u, c) => {
    if (typeof u !== 'string') {
      return t.failure(u, c, AMOUNT_HINT);
    }
    const pence = parsePoundsToPence(u);
    return pence === null ? t.failure(u, c, AMOUNT_HINT) : t.success(pence);
  },
  pence => (pence / 100).toFixed(2)
);

export const PositivePenceFromPoundsString = new t.Type<
  number,
  string,
  unknown
>(
  'PositivePenceFromPoundsString',
  (u): u is number => isPence(u) && u > 0,
  (u, c) => {
    if (typeof u !== 'string') {
      return t.failure(u, c, AMOUNT_HINT);
    }
    const pence = parsePoundsToPence(u);
    if (pence === null) {
      return t.failure(u, c, AMOUNT_HINT);
    }
    return pence > 0
      ? t.success(pence)
      : t.failure(u, c, 'The amount must be more than £0');
  },
  pence => (pence / 100).toFixed(2)
);

const poundsFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

// e.g. 123456 -> "£1,234.56". A negative amount (an overspent budget) keeps
// its sign: "-£12.00".
export const formatPence = (pence: number): string =>
  poundsFormatter.format(pence / 100);
