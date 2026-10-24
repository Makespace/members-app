import * as t from 'io-ts';

// Each e-ink display is flashed once with its own number's URL,
// /e-ink/<n>.png, and what that number shows is chosen in the app (see
// docs/eink-displays.md). Numbers are small and handed out by hand, so a cap
// keeps a typo from creating display 40000.
export const MAX_DISPLAY_NUMBER = 999;

const isDisplayNumber = (n: number) =>
  Number.isInteger(n) && n >= 1 && n <= MAX_DISPLAY_NUMBER;

// A display number as a form posts it ("3") or the API sends it (3). Digits
// only, so "1e2", " 3" or "0x3" are refused rather than read as numbers.
export const parseDisplayNumber = (raw: unknown): number | undefined => {
  const n =
    typeof raw === 'string' && /^\d{1,4}$/.test(raw) ? Number(raw) : raw;
  return typeof n === 'number' && isDisplayNumber(n) ? n : undefined;
};

export const DisplayNumberCodec = new t.Type<number, number, unknown>(
  'DisplayNumber',
  (u): u is number => typeof u === 'number' && isDisplayNumber(u),
  (u, c) => {
    const n = parseDisplayNumber(u);
    return n === undefined ? t.failure(u, c) : t.success(n);
  },
  t.identity
);
