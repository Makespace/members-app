import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {advanceTo} from 'jest-date-mock';
import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {getSomeOrFail, insertRecurlySubscription} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../test-framework';

describe('member email projection', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework?.close();
  });

  it('projects a legacy linked email as verified and primary', async () => {
    const memberNumber = faker.number.int();
    const email = faker.internet.email() as EmailAddress;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email,
      name: undefined,
      formOfAddress: undefined,
    });

    const member = getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(memberNumber));
    expect(member.primaryEmailAddress).toStrictEqual(email);
    expect(member.emails).toHaveLength(1);
    expect(O.isSome(member.emails[0].verifiedAt)).toBe(true);
  });

  it('exposes all emails after grouped member numbers merge', async () => {
    const oldMemberNumber = faker.number.int({min: 1, max: 1000}) as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldEmail = faker.internet.email() as EmailAddress;
    const newEmail = faker.internet.email() as EmailAddress;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: oldEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: newEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
      carryOverTraining: true,
    });

    const member = getSomeOrFail(
      framework.sharedReadModel.members.getByMemberNumber(oldMemberNumber)
    );
    expect(member.primaryEmailAddress).toStrictEqual(newEmail);
    expect(member.emails.map(email => email.emailAddress).sort()).toStrictEqual(
      [newEmail, oldEmail].sort()
    );
  });

  it('only returns member via verified email when requested', async () => {
    const memberNumber = faker.number.int();
    const primaryEmail = faker.internet.email() as EmailAddress;
    const secondaryEmail = faker.internet.email() as EmailAddress;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: primaryEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });

    expect(
      framework.sharedReadModel.members.getByEmail(secondaryEmail, true)
    ).toStrictEqual(O.none);

    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    expect(
      O.isSome(framework.sharedReadModel.members.getByEmail(secondaryEmail, true))
    ).toBe(true);
  });

  it('returns member via any email when requested', async () => {
    const memberNumber = faker.number.int();
    const primaryEmail = faker.internet.email() as EmailAddress;
    const secondaryEmail = faker.internet.email() as EmailAddress;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: primaryEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });

    expect(
      O.isSome(framework.sharedReadModel.members.getByEmail(secondaryEmail, false))
    ).toBe(true);

    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    expect(
      O.isSome(framework.sharedReadModel.members.getByEmail(secondaryEmail, false))
    ).toBe(true);
  });

  it('updates the projected primary email after a primary change', async () => {
    const memberNumber = faker.number.int();
    const primaryEmail = faker.internet.email() as EmailAddress;
    const secondaryEmail = faker.internet.email() as EmailAddress;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: primaryEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });
    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });
    await framework.commands.members.changePrimaryEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const member = getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(memberNumber));
    expect(member.primaryEmailAddress).toStrictEqual(secondaryEmail);
  });

  it('projects when an email verification was last requested', async () => {
    const memberNumber = faker.number.int();
    const primaryEmail = faker.internet.email() as EmailAddress;
    const secondaryEmail = faker.internet.email() as EmailAddress;
    const verificationRequestedAt = faker.date.recent();
    verificationRequestedAt.setMilliseconds(0);

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: primaryEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });

    advanceTo(verificationRequestedAt);
    await framework.commands.members.sendEmailVerification({
      memberNumber,
      email: secondaryEmail,
    });

    const member = getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(memberNumber));
    const requestedEmail = member.emails.find(
      email => email.emailAddress === secondaryEmail
    );
    expect(requestedEmail).toBeDefined();
    expect(requestedEmail?.verificationLastSent).toStrictEqual(
      O.some(verificationRequestedAt)
    );
  });

  describe('an address linked by an admin from Recurly', () => {
    const memberNumber = faker.number.int({min: 1, max: 100_000});
    const billing = 'billing@example.com' as EmailAddress;

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
      await insertRecurlySubscription(framework.extDB, {
        email: billing,
        hasActiveSubscription: true,
      });
    });

    it('is verified and labelled as linked by admin', async () => {
      await framework.commands.members.linkRecurlyEmail({memberNumber, email: billing});
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );
      const linked = member.emails.find(e => e.emailAddress === billing);
      expect(linked).toBeDefined();
      expect(O.isSome(linked!.verifiedAt)).toBe(true);
      expect(linked!.linkedByAdmin).toBe(true);
      expect(O.isSome(framework.sharedReadModel.members.getByEmail(billing, true))).toBe(true);
    });

    it('verifies an address the member had added but not verified, keeping one row', async () => {
      await framework.commands.members.addEmail({memberNumber, email: billing});
      await framework.commands.members.linkRecurlyEmail({memberNumber, email: billing});
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );
      expect(member.emails.filter(e => e.emailAddress === billing)).toHaveLength(1);
      expect(member.emails.find(e => e.emailAddress === billing)?.linkedByAdmin).toBe(true);
    });

    it('does not relabel an address the member verified themselves', async () => {
      await framework.commands.members.addEmail({memberNumber, email: billing});
      await framework.commands.members.verifyEmail({memberNumber, emailAddress: billing});
      await framework.commands.members.linkRecurlyEmail({memberNumber, email: billing});
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );
      expect(member.emails.find(e => e.emailAddress === billing)?.linkedByAdmin).toBe(false);
    });
  });
});
