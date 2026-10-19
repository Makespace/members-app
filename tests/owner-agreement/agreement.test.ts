import * as O from 'fp-ts/Option';
import {
  ownerAgreementStatus,
  reminderDue,
  SignedOwnerAgreement,
} from '../../src/owner-agreement/agreement';
import {
  currentAgreement,
  ORIGINAL_AGREEMENT_KEY,
} from '../../src/owner-agreement/versions';
import {systemBanners} from '../../src/templates/banners';
import {Member} from '../../src/read-models/shared-state/return-types';

const termEnds = new Date('2027-05-01T10:00:00.000Z');

const signed = (
  over: Partial<SignedOwnerAgreement> = {}
): O.Option<SignedOwnerAgreement> =>
  O.some({
    version: currentAgreement.key,
    signedAt: new Date('2026-11-01T10:00:00.000Z'),
    termEnds: O.some(termEnds),
    interestedIn: {equipment: [], area: []},
    reminderSent: O.none,
    ...over,
  });

const at = (iso: string) => new Date(iso);

describe('owner agreement status', () => {
  it('is unsigned for someone who has never signed', () => {
    expect(ownerAgreementStatus(O.none, at('2027-01-01')).state).toBe(
      'unsigned'
    );
  });

  it('is outdated for someone who signed only the original', () => {
    const status = ownerAgreementStatus(
      signed({version: ORIGINAL_AGREEMENT_KEY, termEnds: O.none}),
      at('2027-01-01')
    );
    expect(status.state).toBe('outdated');
  });

  it.each([
    ['2027-03-31T10:00:00.000Z', 'signed'],
    ['2027-04-01T10:00:00.000Z', 'renewal-due'],
    ['2027-04-30T10:00:00.000Z', 'renewal-due'],
    ['2027-05-01T10:00:00.000Z', 'lapsed'],
  ])('at %s is %s', (now, state) => {
    expect(ownerAgreementStatus(signed(), at(now)).state).toBe(state);
  });
});

describe('renewal reminders', () => {
  it.each([
    ['2027-03-31T10:00:00.000Z', O.none],
    ['2027-04-01T10:00:00.000Z', O.some('month')],
    ['2027-04-24T10:00:00.000Z', O.some('week')],
    ['2027-04-30T10:00:00.000Z', O.some('day')],
    ['2027-05-01T10:00:00.000Z', O.none],
  ])('at %s sends %j', (now, expected) => {
    expect(reminderDue(signed(), at(now))).toStrictEqual(expected);
  });

  it('does not repeat a stage already sent', () => {
    expect(
      reminderDue(
        signed({reminderSent: O.some('week')}),
        at('2027-04-25T10:00:00.000Z')
      )
    ).toStrictEqual(O.none);
  });

  it('never reminds about a version without a term', () => {
    expect(
      reminderDue(
        signed({version: ORIGINAL_AGREEMENT_KEY, termEnds: O.none}),
        at('2027-04-30T10:00:00.000Z')
      )
    ).toStrictEqual(O.none);
  });
});

describe('owner agreement banners', () => {
  const member = (
    ownerAgreement: O.Option<SignedOwnerAgreement>,
    isOwner = true
  ) =>
    ({
      ownerAgreement,
      ownerOf: isOwner ? [{}] : [],
    }) as unknown as Member;

  const titles = (
    ownerAgreement: O.Option<SignedOwnerAgreement>,
    now: string,
    isOwner = true
  ) =>
    systemBanners(member(ownerAgreement, isOwner), at(now)).map(
      banner => banner.title
    );

  it('asks owners who have never signed to sign', () => {
    expect(titles(O.none, '2027-01-01')).toStrictEqual([
      "Please sign the Owners' Agreement",
    ]);
  });

  it('asks owners on the original agreement to read the new one', () => {
    expect(
      titles(
        signed({version: ORIGINAL_AGREEMENT_KEY, termEnds: O.none}),
        '2027-01-01'
      )
    ).toStrictEqual(["There's a new Owners' Agreement"]);
  });

  it('says nothing mid-term', () => {
    expect(titles(signed(), '2027-01-01')).toStrictEqual([]);
  });

  it('asks owners to renew in the last month', () => {
    expect(titles(signed(), '2027-04-15')).toStrictEqual([
      "Time to renew your Owners' Agreement",
    ]);
  });

  it('says when a term has lapsed', () => {
    expect(titles(signed(), '2027-06-01')).toStrictEqual([
      "Your Owners' Agreement has lapsed",
    ]);
  });

  it('says nothing to members who are not owners', () => {
    expect(titles(O.none, '2027-01-01', false)).toStrictEqual([]);
  });
});
