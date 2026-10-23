import * as t from 'io-ts';
import * as tt from 'io-ts-types';

// Non-empty text no longer than max characters, so a single form can't
// store an essay of any size. Pages give the same limit as maxlength.
export const limitedText = (max: number) =>
  t.refinement(
    tt.NonEmptyString,
    text => text.length <= max,
    `NonEmptyString of at most ${max} characters`
  );

export const SUMMARY_MAX = 200;
export const LONG_TEXT_MAX = 5_000;
export const REASON_MAX = 2_000;
