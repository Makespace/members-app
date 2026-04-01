import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {addEmail} from '../../../src/commands/members/add-email';
import {changePrimaryEmail} from '../../../src/commands/members/change-primary-email';
import {verifyEmail} from '../../../src/commands/members/verify-email';
import {EmailAddress} from '../../../src/types';
import {arbitraryActor, getLeftOrFail, getSomeOrFail} from '../../helpers';
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

  it('returns a failure when adding an email to an unknown member', async () => {
    const result = getLeftOrFail(
      await addEmail.process({
        command: {
          memberNumber: faker.number.int({min: otherMemberNumber + 1}),
          email: faker.internet.email() as EmailAddress,
          actor: arbitraryActor(),
        },
        events: [],
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message: 'The requested member does not exist',
      status: StatusCodes.NOT_FOUND,
    });
  });

  it('returns a failure when changing the primary email to an unverified email', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });

    const result = getLeftOrFail(
      await changePrimaryEmail.process({
        command: {
          memberNumber,
          email: secondaryEmail,
          actor: arbitraryActor(),
        },
        events: await framework.getAllEvents(),
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message:
        'Invalid request',
      status: StatusCodes.BAD_REQUEST,
    });
  });

  it('allows changing the primary email to a verified email', async () => {
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
      emailAddress: secondaryEmail,
    });
    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    const events = await framework.getAllEventsByType('MemberEmailVerified');
    expect(events).toHaveLength(1);
  });

  it('returns a failure when reusing an email verification link', async () => {
    await framework.commands.members.addEmail({
      memberNumber,
      email: secondaryEmail,
    });
    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    const result = getLeftOrFail(
      await verifyEmail.process({
        command: {
          memberNumber,
          emailAddress: secondaryEmail,
          actor: arbitraryActor(),
        },
        events: await framework.getAllEvents(),
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message: 'The email verification link is no longer valid',
      status: StatusCodes.BAD_REQUEST,
    });
  });
});
