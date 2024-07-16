import {Eq} from 'fp-ts/lib/Eq';
import {string} from 'fp-ts';

export const NullableStringEq: Eq<string | null> = {
  equals(x: string | null, y: string | null) {
    if (x === null || y === null) {
      return x === y;
    }
    return string.Eq.equals(x, y);
  },
};
