import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {advanceTo, clear} from 'jest-date-mock';
import {notifyOwnerAgreementRenewals} from '../../src/sync-worker/notify_owner_agreement_renewals';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {arbitraryUser} from '../types/user.helper';

describe('notifyOwnerAgreementRenewals', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();
  const nonOwner = arbitraryUser();
  // Signed on 1 Nov 2026, so the term ends on 1 May 2027.
  const signedAt = new Date('2026-11-01T10:00:00.000Z');

  let sent: Array<{recipient: string; subject: string}>;

  const run = (at: string) =>
    notifyOwnerAgreementRenewals(
      {
        ...framework.depsForCommands,
        conf: {PUBLIC_URL: 'http://localhost:8080'},
        sendEmail: (email: {recipient: string; subject: string}) => () =>
          Promise.resolve(
            (sent.push({recipient: email.recipient, subject: email.subject}),
            {_tag: 'Right' as const, right: 'ok'})
          ),
      } as unknown as Parameters<typeof notifyOwnerAgreementRenewals>[0],
      new Date(at)
    );

  const sign = async (memberNumber: number, at: Date) => {
    advanceTo(at);
    await framework.commands.members.signOwnerAgreement({
      memberNumber,
      signedAt: at,
    });
  };

  beforeEach(async () => {
    sent = [];
    framework = await initTestFramework();
    for (const member of [owner, nonOwner]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
    await sign(owner.memberNumber, signedAt);
    await sign(nonOwner.memberNumber, signedAt);
  });

  afterEach(() => {
    clear();
    framework.close();
  });

  it('sends nothing while the term has more than a month to run', async () => {
    await run('2027-03-15T10:00:00.000Z');
    expect(sent).toStrictEqual([]);
  });

  it('reminds an owner a month before their term ends, once', async () => {
    await run('2027-04-02T10:00:00.000Z');
    await run('2027-04-03T10:00:00.000Z');

    expect(sent).toStrictEqual([
      {
        recipient: owner.emailAddress,
        subject: "Your Owners' Agreement ends in a month",
      },
    ]);
  });

  it('reminds again a week and a day before', async () => {
    await run('2027-04-02T10:00:00.000Z');
    await run('2027-04-25T10:00:00.000Z');
    await run('2027-04-30T11:00:00.000Z');
    await run('2027-04-30T12:00:00.000Z');

    expect(sent.map(email => email.subject)).toStrictEqual([
      "Your Owners' Agreement ends in a month",
      "Your Owners' Agreement ends in a week",
      "Your Owners' Agreement ends tomorrow",
    ]);
  });

  it('skips reminders it missed rather than sending them late', async () => {
    await run('2027-04-30T11:00:00.000Z');

    expect(sent.map(email => email.subject)).toStrictEqual([
      "Your Owners' Agreement ends tomorrow",
    ]);
  });

  it('stops once the term has ended', async () => {
    await run('2027-05-02T10:00:00.000Z');
    expect(sent).toStrictEqual([]);
  });

  it('does not remind someone who has already renewed', async () => {
    await sign(owner.memberNumber, new Date('2027-04-10T10:00:00.000Z'));
    await run('2027-04-25T10:00:00.000Z');
    expect(sent).toStrictEqual([]);
  });

  it('only reminds owners', async () => {
    await run('2027-04-02T10:00:00.000Z');
    expect(sent.map(email => email.recipient)).not.toContain(
      nonOwner.emailAddress
    );
  });
});
