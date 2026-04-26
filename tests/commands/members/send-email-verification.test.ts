import * as O from 'fp-ts/Option';
import {advanceTo, clear} from 'jest-date-mock';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {EmailAddress, constructEvent, isEventOfType} from '../../../src/types';
import {sendEmailVerification} from '../../../src/commands/members/send-email-verification';
import {
  arbitraryActor,
  getLeftOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {pipe} from 'fp-ts/lib/function';

describe('send-email-verification', () => {
  let framework: TestFramework;
  const memberNumber = faker.number.int();
  const primaryEmail = faker.internet.email() as EmailAddress;
  const secondaryEmail = faker.internet.email() as EmailAddress;

  beforeEach(async () => {
    framework = await initTestFramework();
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
  });

  afterEach(() => {
    clear();
    framework.close();
  });

  const command = {
    memberNumber,
    email: secondaryEmail,
    actor: arbitraryActor(),
  };

  it('fails when the member does not exist', async () => {
    const result = getLeftOrFail(
      await sendEmailVerification.process({
        command: {
          ...command,
          memberNumber: faker.number.int({min: memberNumber + 1}),
        },
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message: 'The requested member does not exist',
      status: StatusCodes.NOT_FOUND,
    });
  });

  it('fails when the email is not attached to the member', async () => {
    const result = getLeftOrFail(
      await sendEmailVerification.process({
        command: {
          ...command,
          email: faker.internet.email() as EmailAddress,
        },
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message: 'The requested email address is not attached to this member',
      status: StatusCodes.BAD_REQUEST,
    });
  });

  it('does nothing when the email is already verified', async () => {
    await framework.commands.members.verifyEmail({
      memberNumber,
      emailAddress: secondaryEmail,
    });

    const result = await getTaskEitherRightOrFail(
      sendEmailVerification.process({
        command,
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(O.none);
  });

  it('does nothing when the cooldown has not elapsed', async () => {
    const requestedAt = faker.date.recent();
    requestedAt.setMilliseconds(0);
    advanceTo(requestedAt);
    framework.insertIntoSharedReadModel(
      constructEvent('MemberEmailVerificationRequested')({
        memberNumber,
        email: secondaryEmail,
        actor: arbitraryActor(),
      })
    );
    advanceTo(
      new Date(requestedAt.getTime() + 1)
    );

    const result = await getTaskEitherRightOrFail(
      sendEmailVerification.process({
        command,
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(O.none);
  });

  it('raises a verification requested event for an attached unverified email', async () => {
    const event = pipe(
      await getTaskEitherRightOrFail(
        sendEmailVerification.process({
          command,
          rm: framework.sharedReadModel,
        })
      ),
      O.filter(isEventOfType('MemberEmailVerificationRequested')),
      getSomeOrFail
    );

    expect(event.memberNumber).toStrictEqual(memberNumber);
    expect(event.email).toStrictEqual(secondaryEmail);
  });
});
