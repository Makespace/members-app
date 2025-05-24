import {Duration} from 'luxon';

type MemberNumber = number;

export const TRAINING_LAPSE_PERIOD = Duration.fromObject({
  months: 6,
});

export class MemberLinking {
  // Stores the linking between member numbers.
  // This is much more effiently stored directly rather than using sqllite as its
  // required for almost every operation.
  // I previously tried sqllite for this and it was messy.

  // This stores every member number. If the account has no grouping it still
  // appears here to allow easy enumeration of all member numbers without duplicates.
  private grouping: Set<MemberNumber>[];

  constructor() {
    this.grouping = [];
  }

  link(numbers: readonly MemberNumber[]) {
    const newGrouping = new Set(numbers);
    this.grouping = this.grouping.filter(group => {
      for (const memberNumber of numbers) {
        if (group.has(memberNumber)) {
          numbers.forEach(n => newGrouping.add(n));
          group.forEach(n => newGrouping.add(n));
          return false;
        }
      }
      return true;
    });
    this.grouping.push(newGrouping);
  }

  all(): Readonly<Set<MemberNumber>[]> {
    return this.grouping;
  }

  map(a: MemberNumber): ReadonlySet<MemberNumber> {
    for (const group of this.grouping) {
      if (group.has(a)) {
        return group;
      }
    }
    return new Set([a]);
  }

  mapAll(all: readonly MemberNumber[]): ReadonlySet<MemberNumber>[] {
    return Array.from(new Set(all.map(this.map)));
  }
}
