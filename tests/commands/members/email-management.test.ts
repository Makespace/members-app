import {faker} from '@faker-js/faker';
import {EmailAddress} from '../../../src/types';
import {getSomeOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('member email commands', () => {
  let framework: TestFramework;
  const memberNumber = faker.number.int();
  const otherMemberNumber = faker.number.int({min: memberNumber + 1});
  const primaryEmail = faker.internet.email() as EmailAddress;
  const otherMemberEmail = faker.internet.email() as EmailAddress;
  const secondaryEmail = faker.internet.email() as EmailAddress;

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: primaryEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: otherMemberNumber,
      email: otherMemberEmail,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  afterEach(() => {
    framework?.close();
  });

  it('adds an unverified email to a member', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const member = getSomeOrFail(framework.sharedReadModel.members.get(memberNumber));
    const addedEmail = member.emails.find(
      email => email.emailAddress === secondaryEmail
    );

    expect(addedEmail).toBeDefined();
    expect(addedEmail?.verifiedAt._tag).toStrictEqual('None');
  });

  it('rejects add when the email belongs to another member', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: otherMemberEmail,
    });

    const events = await framework.getAllEventsByType(
      'LinkingMemberNumberToAnAlreadyUsedEmailAttempted'
    );
    expect(events).toHaveLength(1);
    expect(events[0].email).toStrictEqual(otherMemberEmail);
  });

  it('is a no-op when re-adding the same email to the same member', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const events = await framework.getAllEventsByType('MemberEmailAdded');
    expect(events).toHaveLength(1);
  });

  it('does not allow changing the primary email to an unverified email', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });
    await framework.commands.members.changePrimaryEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const events = await framework.getAllEventsByType('MemberPrimaryEmailChanged');
    expect(events).toHaveLength(0);
    expect(
      getSomeOrFail(framework.sharedReadModel.members.get(memberNumber))
        .primaryEmailAddress
    ).toStrictEqual(primaryEmail);
  });

  it('allows changing the primary email to a verified email', async () => {
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

  it('treats verification as idempotent', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });
    await framework.commands.members.verifyEmail({
      memberNumber,
      email: secondaryEmail,
    });
    await framework.commands.members.verifyEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const events = await framework.getAllEventsByType('MemberEmailVerified');
    expect(events).toHaveLength(1);
  });
});
