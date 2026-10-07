import * as O from 'fp-ts/Option';
import {MemberCoreInfo, MemberFob} from '../read-models/shared-state/return-types';
import {PaxtonFobRow} from './parse-export';

// Paxton access levels are numbered. 5, 6 and 7 are door, university and
// varsity tokens that belong to no member; everything else (active, parked,
// cancelled, sanctioned) is a person.
const NON_MEMBER_ACCESS_LEVEL = /^[567]\b/;

type Change = 'new' | 'updated' | 'moved' | 'unchanged';

export type Outcome =
  // A door or university token, not a person: nothing to record.
  | {kind: 'not-a-member'}
  // The export lists this fob id twice; only the first occurrence counts.
  | {kind: 'duplicate-fob'}
  // The name carries a member number the app does not know.
  | {kind: 'unknown-number'; memberNumber: number}
  // No member number and no member with that name.
  | {kind: 'unmatched'}
  // No member number and several members could be that name.
  | {kind: 'ambiguous'; candidates: ReadonlyArray<MemberCoreInfo>}
  | {
      kind: 'matched';
      member: MemberCoreInfo;
      how: 'number' | 'name';
      // For a match by number: does the Paxton name look like the app's name
      // for that member? None when the app has no name to compare with.
      nameAgrees: O.Option<boolean>;
      change: Change;
      // For 'moved': who the app currently has holding this fob.
      previousHolder: O.Option<MemberCoreInfo>;
    };

export type MatchedRow = {row: PaxtonFobRow; outcome: Outcome};

// A fob the app has that the export no longer lists.
export type Removal = {member: MemberCoreInfo; fob: MemberFob};

export type MatchResult = {
  rows: ReadonlyArray<MatchedRow>;
  removals: ReadonlyArray<Removal>;
};

// The member number is whatever single run of digits sits in the Paxton
// name: "Molly Millions 1337", "1337 Millions, Molly" and "Millions, Molly
// (1337)" all give 1337. Two numbers (e.g. "16/17 ...") is no number.
export const memberNumberInName = (name: string): O.Option<number> => {
  const numbers = name.match(/\d+/g) ?? [];
  return numbers.length === 1 ? O.some(Number(numbers[0])) : O.none;
};

// Name tokens for loose comparison: lower-cased letters only, brackets (a
// nickname, usually) dropped, digits dropped, sorted. "Millions, Molly 1337"
// and "Molly Millions" both give ["millions", "molly"].
export const nameTokens = (name: string): ReadonlyArray<string> =>
  name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}]+/gu, ' ')
    .split(' ')
    .filter(token => token !== '')
    .sort();

// Two names are the same person's when their tokens are equal, or one is a
// subset of the other with at least two tokens shared (a middle name or
// initial on one side only).
const sameName = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): boolean => {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < 2) {
    return shorter.length === 1 && longer.length === 1 && shorter[0] === longer[0];
  }
  const longerSet = new Set(longer);
  return shorter.every(token => longerSet.has(token));
};

const sharesAToken = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): boolean => {
  const bSet = new Set(b);
  return a.some(token => bSet.has(token));
};

export const matchFobs = (
  rows: ReadonlyArray<PaxtonFobRow>,
  members: ReadonlyArray<MemberCoreInfo>
): MatchResult => {
  const byNumber = new Map<number, MemberCoreInfo>();
  const holderOfFob = new Map<number, {member: MemberCoreInfo; fob: MemberFob}>();
  const byNameToken = new Map<string, Set<MemberCoreInfo>>();
  const tokensOf = new Map<MemberCoreInfo, ReadonlyArray<string>>();
  for (const member of members) {
    for (const number of [member.memberNumber, ...member.pastMemberNumbers]) {
      byNumber.set(number, member);
    }
    for (const fob of member.fobs) {
      holderOfFob.set(fob.fobId, {member, fob});
    }
    if (O.isSome(member.name)) {
      const tokens = nameTokens(member.name.value);
      tokensOf.set(member, tokens);
      for (const token of tokens) {
        const set = byNameToken.get(token) ?? new Set();
        set.add(member);
        byNameToken.set(token, set);
      }
    }
  }

  const change = (
    row: PaxtonFobRow,
    member: MemberCoreInfo
  ): Pick<Extract<Outcome, {kind: 'matched'}>, 'change' | 'previousHolder'> => {
    const holder = holderOfFob.get(row.fobId);
    if (holder === undefined) {
      return {change: 'new', previousHolder: O.none};
    }
    if (holder.member.userId !== member.userId) {
      return {change: 'moved', previousHolder: O.some(holder.member)};
    }
    const unchanged =
      holder.fob.accessLevel === row.accessLevel &&
      holder.fob.paxtonName === row.paxtonName;
    return {change: unchanged ? 'unchanged' : 'updated', previousHolder: O.none};
  };

  const seenFobs = new Set<number>();
  const matched: MatchedRow[] = rows.map(row => {
    if (NON_MEMBER_ACCESS_LEVEL.test(row.accessLevel)) {
      return {row, outcome: {kind: 'not-a-member'}};
    }
    if (seenFobs.has(row.fobId)) {
      return {row, outcome: {kind: 'duplicate-fob'}};
    }
    seenFobs.add(row.fobId);

    const rowTokens = nameTokens(row.paxtonName);
    const number = memberNumberInName(row.paxtonName);
    if (O.isSome(number)) {
      const member = byNumber.get(number.value);
      if (member === undefined) {
        return {row, outcome: {kind: 'unknown-number', memberNumber: number.value}};
      }
      const memberTokens = tokensOf.get(member);
      return {
        row,
        outcome: {
          kind: 'matched',
          member,
          how: 'number',
          nameAgrees:
            memberTokens === undefined
              ? O.none
              : O.some(sharesAToken(rowTokens, memberTokens)),
          ...change(row, member),
        },
      };
    }

    const candidates = new Set<MemberCoreInfo>();
    for (const token of rowTokens) {
      for (const member of byNameToken.get(token) ?? []) {
        if (sameName(rowTokens, tokensOf.get(member) ?? [])) {
          candidates.add(member);
        }
      }
    }
    if (candidates.size === 0) {
      return {row, outcome: {kind: 'unmatched'}};
    }
    if (candidates.size > 1) {
      return {row, outcome: {kind: 'ambiguous', candidates: [...candidates]}};
    }
    const [member] = candidates;
    return {
      row,
      outcome: {
        kind: 'matched',
        member,
        how: 'name',
        nameAgrees: O.some(true),
        ...change(row, member),
      },
    };
  });

  const exported = new Set<number>(rows.map(row => row.fobId));
  const removals: Removal[] = [];
  for (const member of members) {
    for (const fob of member.fobs) {
      if (!exported.has(fob.fobId)) {
        removals.push({member, fob});
      }
    }
  }

  return {rows: matched, removals};
};
