import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {
  matchFobs,
  memberNumberInName,
  nameTokens,
} from '../../src/paxton/match-fobs';
import {PaxtonFobRow} from '../../src/paxton/parse-export';
import {
  MemberCoreInfo,
  MemberFob,
} from '../../src/read-models/shared-state/return-types';
import {EmailAddress, GravatarHash} from '../../src/types';

const member = (
  memberNumber: number,
  name: string | undefined,
  fobs: ReadonlyArray<MemberFob> = [],
  pastMemberNumbers: ReadonlyArray<number> = []
): MemberCoreInfo => ({
  userId: faker.string.uuid() as UUID,
  memberNumber,
  pastMemberNumbers,
  primaryEmailAddress: `member-${memberNumber}@example.com` as EmailAddress,
  emails: [],
  fobs,
  name: O.fromNullable(name),
  formOfAddress: O.none,
  agreementSigned: O.none,
  isSuperUser: false,
  superUserSince: O.none,
  gravatarHash: 'hash' as unknown as GravatarHash,
  joined: new Date('2026-01-01T00:00:00.000Z'),
});

const fob = (
  fobId: number,
  accessLevel: string,
  paxtonName: string
): MemberFob => ({
  fobId,
  accessLevel,
  paxtonName,
  recordedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const row = (
  paxtonName: string,
  fobId: number,
  accessLevel = '1a - Active Members'
): PaxtonFobRow => ({
  paxtonName,
  accessLevel,
  fobId: fobId as Int,
  addedAt: O.none,
});

describe('memberNumberInName', () => {
  it.each([
    ['Millions, Molly 1337', 1337],
    ['1337 Millions, Molly', 1337],
    ['Millions 1337, Molly', 1337],
    ['Millions, Molly (1337 )', 1337],
    ['Millions, Molly -23', 23],
  ])('finds the number in %s', (name, expected) => {
    expect(memberNumberInName(name)).toStrictEqual(O.some(expected));
  });

  it.each([['Millions, Molly'], ['16/17 Millions, Molly'], ['Door 1 2']])(
    'finds no single number in %s',
    name => {
      expect(memberNumberInName(name)).toStrictEqual(O.none);
    }
  );
});

describe('nameTokens', () => {
  it('normalises Paxton and app spellings to the same tokens', () => {
    expect(nameTokens('Millions, Molly 1337')).toStrictEqual(
      nameTokens('Molly Millions')
    );
    expect(nameTokens("O'Brien-Smith, Ann (Annie)")).toStrictEqual([
      'ann',
      'brien',
      'o',
      'smith',
    ]);
  });
});

describe('matchFobs', () => {
  describe('by member number', () => {
    const molly = member(1337, 'Molly Millions');

    it('matches the member and reports a new fob', () => {
      const result = matchFobs([row('Millions, Molly 1337', 1)], [molly]);
      expect(result.rows[0].outcome).toMatchObject({
        kind: 'matched',
        member: molly,
        how: 'number',
        nameAgrees: O.some(true),
        change: 'new',
      });
      expect(result.removals).toStrictEqual([]);
    });

    it('matches a past member number to the current record', () => {
      const rejoined = member(2000, 'Molly Millions', [], [1337]);
      const result = matchFobs([row('Millions, Molly 1337', 1)], [rejoined]);
      expect(result.rows[0].outcome).toMatchObject({
        kind: 'matched',
        member: rejoined,
      });
    });

    it('flags a name that does not look like the member it points at', () => {
      const result = matchFobs([row('Case, Henry 1337', 1)], [molly]);
      expect(result.rows[0].outcome).toMatchObject({
        kind: 'matched',
        nameAgrees: O.some(false),
      });
    });

    it('cannot judge the name when the app has none', () => {
      const result = matchFobs(
        [row('Case, Henry 1337', 1)],
        [member(1337, undefined)]
      );
      expect(result.rows[0].outcome).toMatchObject({nameAgrees: O.none});
    });

    it('reports an unknown number', () => {
      const result = matchFobs([row('Case, Henry 999', 1)], [molly]);
      expect(result.rows[0].outcome).toStrictEqual({
        kind: 'unknown-number',
        memberNumber: 999,
      });
    });
  });

  describe('by name', () => {
    it('matches the one member with that name', () => {
      const molly = member(1337, 'Molly Millions');
      const result = matchFobs(
        [row('Millions, Molly', 1)],
        [molly, member(2, 'Henry Case')]
      );
      expect(result.rows[0].outcome).toMatchObject({
        kind: 'matched',
        member: molly,
        how: 'name',
      });
    });

    it('tolerates a middle name on one side only', () => {
      const molly = member(1337, 'Molly A Millions');
      const result = matchFobs([row('Millions, Molly', 1)], [molly]);
      expect(result.rows[0].outcome).toMatchObject({kind: 'matched', member: molly});
    });

    it('ignores a bracketed nickname', () => {
      const molly = member(1337, 'Molly Millions');
      const result = matchFobs([row('Millions, Molly (Moll)', 1)], [molly]);
      expect(result.rows[0].outcome).toMatchObject({kind: 'matched', member: molly});
    });

    it('does not match on a surname alone', () => {
      const result = matchFobs(
        [row('Millions, Molly', 1)],
        [member(1, 'Henry Millions')]
      );
      expect(result.rows[0].outcome).toStrictEqual({kind: 'unmatched'});
    });

    it('is ambiguous when two members share the name', () => {
      const a = member(1, 'Molly Millions');
      const b = member(2, 'Molly Millions');
      const result = matchFobs([row('Millions, Molly', 1)], [a, b]);
      expect(result.rows[0].outcome).toMatchObject({kind: 'ambiguous'});
      const outcome = result.rows[0].outcome;
      expect(outcome.kind === 'ambiguous' && outcome.candidates).toHaveLength(2);
    });

    it('is unmatched when nobody has the name', () => {
      const result = matchFobs(
        [row('Millions, Molly', 1)],
        [member(1, 'Henry Case')]
      );
      expect(result.rows[0].outcome).toStrictEqual({kind: 'unmatched'});
    });
  });

  describe('changes against what the app already has', () => {
    const existing = fob(1, '1a - Active Members', 'Millions, Molly 1337');

    it('is unchanged when the fob is recorded exactly so', () => {
      const molly = member(1337, 'Molly Millions', [existing]);
      const result = matchFobs([row('Millions, Molly 1337', 1)], [molly]);
      expect(result.rows[0].outcome).toMatchObject({change: 'unchanged'});
    });

    it('is updated when the access level changed', () => {
      const molly = member(1337, 'Molly Millions', [existing]);
      const result = matchFobs(
        [row('Millions, Molly 1337', 1, '3 - Cancelled Members')],
        [molly]
      );
      expect(result.rows[0].outcome).toMatchObject({change: 'updated'});
    });

    it('is moved when another member holds the fob', () => {
      const henry = member(2, 'Henry Case', [existing]);
      const molly = member(1337, 'Molly Millions');
      const result = matchFobs([row('Millions, Molly 1337', 1)], [henry, molly]);
      expect(result.rows[0].outcome).toMatchObject({
        change: 'moved',
        previousHolder: O.some(henry),
      });
    });

    it('lists fobs the export no longer has for removal', () => {
      const molly = member(1337, 'Molly Millions', [existing, fob(2, '1a', 'x')]);
      const result = matchFobs([row('Millions, Molly 1337', 1)], [molly]);
      expect(result.removals).toStrictEqual([
        {member: molly, fob: fob(2, '1a', 'x')},
      ]);
    });
  });

  describe('rows that are not members', () => {
    it.each([
      ['5 - Special Door Tokens'],
      ['6 - University Access'],
      ['7 - Varsity Access'],
    ])('skips %s', level => {
      const result = matchFobs([row('Door 1', 1, level)], [member(1, 'Door')]);
      expect(result.rows[0].outcome).toStrictEqual({kind: 'not-a-member'});
    });

    it('treats sanctioned and parked members as members', () => {
      const molly = member(1337, 'Molly Millions');
      const result = matchFobs(
        [
          row('Millions, Molly 1337', 1, '9 - Sanctions'),
          row('Millions, Molly 1337', 2, '2 - Parked Members'),
        ],
        [molly]
      );
      expect(result.rows.map(r => r.outcome.kind)).toStrictEqual([
        'matched',
        'matched',
      ]);
    });
  });

  it('only counts the first of a duplicated fob id', () => {
    const molly = member(1337, 'Molly Millions');
    const result = matchFobs(
      [row('Millions, Molly 1337', 1), row('Case, Henry 2', 1)],
      [molly]
    );
    expect(result.rows.map(r => r.outcome.kind)).toStrictEqual([
      'matched',
      'duplicate-fob',
    ]);
  });
});
