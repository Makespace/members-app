import {NonEmptyArray} from 'fp-ts/lib/NonEmptyArray';
import {ReadonlyNonEmptyArray} from 'fp-ts/lib/ReadonlyNonEmptyArray';

export const groupMembershipNumbers = (
  rows: {
    a: number;
    b: number;
  }[]
): ReadonlyArray<ReadonlyNonEmptyArray<number>> => {
  const grouping: Set<number>[] = [];
  for (const row of rows) {
    let found = false;
    for (const group of grouping) {
      if (group.has(row.a) || group.has(row.b)) {
        group.add(row.a);
        group.add(row.b);
        found = true;
        break;
      }
    }
    if (!found) {
      grouping.push(new Set([row.a, row.b]));
    }
  }
  // We know it must be non-empty because we init the set with entries.
  return grouping.map(m => Array.from(m.values()) as NonEmptyArray<number>);
};
