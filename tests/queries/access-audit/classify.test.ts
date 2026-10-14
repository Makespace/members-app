import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {
  AuditRow,
  entitlementOf,
  fobAccessOfMember,
  groupRows,
} from '../../../src/queries/access-audit/classify';
import {MemberCoreInfo} from '../../../src/read-models/shared-state/return-types';
import {EmailAddress, GravatarHash} from '../../../src/types';
import {RecurlyFlags} from '../../../src/read-models/external-state/recurly-status';

const thresholds = {removeAccessAfterDays: 14, cancelAfterDays: 60};

const member = (levels: ReadonlyArray<string>): MemberCoreInfo => ({
  userId: faker.string.uuid() as UUID,
  memberNumber: faker.number.int({min: 1, max: 10_000}),
  pastMemberNumbers: [],
  primaryEmailAddress: 'x@example.com' as EmailAddress,
  emails: [],
  fobs: levels.map((accessLevel, i) => ({
    fobId: i + 1,
    accessLevel,
    paxtonName: 'x',
    recordedAt: new Date('2026-01-01T00:00:00.000Z'),
  })),
  name: O.none,
  formOfAddress: O.none,
  agreementSigned: O.none,
  isSuperUser: false,
  superUserSince: O.none,
  gravatarHash: 'hash' as unknown as GravatarHash,
  joined: new Date('2026-01-01T00:00:00.000Z'),
});

const flags = (overrides: Partial<RecurlyFlags> = {}): O.Option<RecurlyFlags> =>
  O.some({
    hasActiveSubscription: false,
    hasFutureSubscription: false,
    hasCanceledSubscription: false,
    hasPausedSubscription: false,
    hasPastDueInvoice: false,
    ...overrides,
  });

describe('fobAccessOfMember', () => {
  it.each([
    [[], 'none'],
    [['1a - Active Members'], 'live'],
    [['1b - Active Members + Stockroom'], 'live'],
    [['1c - Management Team'], 'live'],
    [['2 - Parked Members'], 'parked'],
    [['3 - Cancelled Members'], 'cancelled'],
    [['9 - Sanctions'], 'sanctioned'],
    // The most permissive fob is the one that opens the door.
    [['3 - Cancelled Members', '1a - Active Members'], 'live'],
    [['3 - Cancelled Members', '2 - Parked Members'], 'parked'],
    [['9 - Sanctions', '3 - Cancelled Members'], 'sanctioned'],
  ])('%j gives %s', (levels, expected) => {
    expect(fobAccessOfMember(member(levels))).toStrictEqual(expected);
  });
});

describe('entitlementOf', () => {
  it('is entitled with an active subscription', () => {
    expect(
      entitlementOf(
        {flags: flags({hasActiveSubscription: true}), reasons: []},
        O.none,
        thresholds
      )
    ).toStrictEqual({kind: 'entitled'});
  });

  it('stays entitled while cancelled within the paid term', () => {
    expect(
      entitlementOf(
        {
          flags: flags({hasActiveSubscription: true, hasCanceledSubscription: true}),
          reasons: ['cancelled-in-term'],
        },
        O.none,
        thresholds
      )
    ).toStrictEqual({kind: 'entitled'});
  });

  it('stays entitled when a little overdue', () => {
    expect(
      entitlementOf(
        {flags: flags({hasActiveSubscription: true}), reasons: []},
        O.some({kind: 'overdue', daysOverdue: O.some(13)}),
        thresholds
      )
    ).toStrictEqual({kind: 'entitled'});
  });

  it('loses entitlement once overdue past the remove-access threshold', () => {
    expect(
      entitlementOf(
        {flags: flags({hasActiveSubscription: true}), reasons: []},
        O.some({kind: 'overdue', daysOverdue: O.some(14)}),
        thresholds
      )
    ).toStrictEqual({kind: 'not-entitled', why: 'overdue', daysOverdue: O.some(14)});
  });

  it('ignores a paused-owing concern for the overdue rule', () => {
    expect(
      entitlementOf(
        {flags: flags({hasActiveSubscription: true}), reasons: []},
        O.some({kind: 'paused-owing', daysOverdue: O.some(90)}),
        thresholds
      )
    ).toStrictEqual({kind: 'entitled'});
  });

  it.each([
    [{flags: O.none, reasons: ['no-data']}, 'no-data'],
    [{flags: flags(), reasons: ['expired']}, 'expired'],
    [{flags: flags({hasFutureSubscription: true}), reasons: ['future-only']}, 'future-only'],
    [{flags: flags({hasPausedSubscription: true}), reasons: ['paused']}, 'paused'],
  ] as const)('explains why not: %j -> %s', (recurly, why) => {
    expect(entitlementOf(recurly, O.none, thresholds)).toStrictEqual({
      kind: 'not-entitled',
      why,
      daysOverdue: O.none,
    });
  });
});

describe('groupRows', () => {
  const entitled = {kind: 'entitled'} as const;
  const lapsed = {kind: 'not-entitled', why: 'expired', daysOverdue: O.none} as const;
  const row = (levels: ReadonlyArray<string>, entitlement: AuditRow['entitlement']): AuditRow => ({
    member: member(levels),
    fobAccess: fobAccessOfMember(member(levels)),
    entitlement,
  });

  it('sorts every combination into the right list', () => {
    const rows = [
      row(['1a - Active Members'], lapsed), // revoke
      row(['3 - Cancelled Members'], lapsed), // consistent
      row([], lapsed), // consistent
      row(['1a - Active Members'], entitled), // consistent
      row(['3 - Cancelled Members'], entitled), // reinstate
      row([], entitled), // no fob
      row(['2 - Parked Members'], entitled), // paused on purpose
      row(['9 - Sanctions'], entitled), // paused on purpose
      row(['2 - Parked Members'], lapsed), // consistent: not entitled, not live
    ];
    const groups = groupRows(rows);
    expect(groups.toRevoke).toStrictEqual([rows[0]]);
    expect(groups.toReinstate).toStrictEqual([rows[4]]);
    expect(groups.noFob).toStrictEqual([rows[5]]);
    expect(groups.pausedOnPurpose).toStrictEqual([rows[6], rows[7]]);
    expect(groups.consistent).toStrictEqual(4);
  });
});
