type MemberNumber = number;

export class MemberLinking {
  // Stores the linking between member numbers.
  // This is much more effiently stored directly rather than using sqllite as its
  // required for almost every operation.
  // I previously tried sqllite for this and it was messy.

  private grouping: Set<MemberNumber>[];

  constructor() {
    this.grouping = [];
  }

  add(a: MemberNumber, b: MemberNumber) {
    for (const group of this.grouping) {
      if (group.has(a) || group.has(b)) {
        group.add(a);
        group.add(b);
        return;
      }
    }
    this.grouping.push(new Set([a, b]));
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

  mapAll(all: MemberNumber[]): ReadonlySet<MemberNumber>[] {
    return all.map(this.map);
  }
}
