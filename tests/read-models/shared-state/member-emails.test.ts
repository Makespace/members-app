import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
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

    const member = getSomeOrFail(framework.sharedReadModel.members.get(memberNumber));
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
      framework.sharedReadModel.members.get(oldMemberNumber)
    );
    expect(member.primaryEmailAddress).toStrictEqual(newEmail);
    expect(member.emails.map(email => email.emailAddress).sort()).toStrictEqual(
      [newEmail, oldEmail].sort()
    );
  });

  it('only returns verified emails from findByEmail', async () => {
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
      framework.sharedReadModel.members.findByEmail(secondaryEmail)
    ).toHaveLength(0);

    await framework.commands.members.verifyEmail({
      memberNumber,
      email: secondaryEmail,
    });

    expect(
      framework.sharedReadModel.members.findByEmail(secondaryEmail)
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
      email: secondaryEmail,
    });
    await framework.commands.members.changePrimaryEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const member = getSomeOrFail(framework.sharedReadModel.members.get(memberNumber));
    expect(member.primaryEmailAddress).toStrictEqual(secondaryEmail);
  });
});
