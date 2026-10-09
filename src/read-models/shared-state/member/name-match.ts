import * as O from 'fp-ts/Option';
import {MemberCoreInfo} from '../return-types';

// Loose name matching for data that arrives from elsewhere (the Paxton
// export, Recurly accounts) and names a person rather than a member number.

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

export const sharesAToken = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): boolean => {
  const bSet = new Set(b);
  return a.some(token => bSet.has(token));
};

// Built once from every member, then answers "who is this name?" cheaply:
// the members whose recorded name is the same person's.
type NameIndex = {
  candidates: (name: string) => ReadonlyArray<MemberCoreInfo>;
  // The one member it could be, or none when nobody or several match.
  unique: (name: string) => O.Option<MemberCoreInfo>;
};

export const indexMembersByName = (
  members: ReadonlyArray<MemberCoreInfo>
): NameIndex => {
  const byToken = new Map<string, Set<MemberCoreInfo>>();
  const tokensOf = new Map<MemberCoreInfo, ReadonlyArray<string>>();
  for (const member of members) {
    if (O.isNone(member.name)) {
      continue;
    }
    const tokens = nameTokens(member.name.value);
    tokensOf.set(member, tokens);
    for (const token of tokens) {
      const set = byToken.get(token) ?? new Set();
      set.add(member);
      byToken.set(token, set);
    }
  }
  const candidates = (name: string): ReadonlyArray<MemberCoreInfo> => {
    const tokens = nameTokens(name);
    const found = new Set<MemberCoreInfo>();
    for (const token of tokens) {
      for (const member of byToken.get(token) ?? []) {
        if (sameName(tokens, tokensOf.get(member) ?? [])) {
          found.add(member);
        }
      }
    }
    return [...found];
  };
  return {
    candidates,
    unique: name => {
      const found = candidates(name);
      return found.length === 1 ? O.some(found[0]) : O.none;
    },
  };
};
