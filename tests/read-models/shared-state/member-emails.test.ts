import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {advanceTo} from 'jest-date-mock';
import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {getSomeOrFail} from '../../helpers';
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
    ).toHaveLength(0);

    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    expect(
      framework.sharedReadModel.members.getByEmail(secondaryEmail, true)
    ).toHaveLength(1);
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
      framework.sharedReadModel.members.getByEmail(secondaryEmail, false)
    ).toHaveLength(1);

    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    expect(
      framework.sharedReadModel.members.getByEmail(secondaryEmail, false)
    ).toHaveLength(1);
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
});
