import {faker} from '@faker-js/faker';
import {sendMemberNumberToEmail} from '../../src/pubsub-subscribers/send-member-number-to-email';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EmailAddress, Failure, failure} from '../../src/types';

describe('send-member-number-to-email', () => {
  const emailAddress = faker.internet.email() as EmailAddress;
  const memberNumber = faker.datatype.number();

  describe('when the email can be uniquely linked to a member number', () => {
    const adapters = {
      getMemberNumber: () => TE.right(memberNumber),
      rateLimitSendingOfEmails: TE.right,
      sendEmail: jest.fn(() => TE.right('success')),
    };

    beforeEach(async () => {
      await sendMemberNumberToEmail(adapters)(emailAddress)();
    });

    it('tries to send an email with the number', () => {
      expect(adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: emailAddress,
          message: expect.stringContaining(memberNumber.toString()),
        })
      );
    });
  });

  describe('when database query fails', () => {
    const errorMsg = 'db query failed';
    const adapters = {
      getMemberNumber: () => TE.left(failure(errorMsg)({})),
      rateLimitSendingOfEmails: TE.right,
      sendEmail: jest.fn(() => TE.right('success')),
    };

    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(emailAddress)();
    });

    it('does not send any emails', () => {
      expect(adapters.sendEmail).not.toHaveBeenCalled();
    });

    it('return on Left with message from db adapter', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });
  });

  describe('when email fails to send', () => {
    const errorMsg = 'sending of email failed';
    const adapters = {
      getMemberNumber: () => TE.right(memberNumber),
      rateLimitSendingOfEmails: TE.right,
      sendEmail: () => TE.left(failure(errorMsg)()),
    };

    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(emailAddress)();
    });

    it('returns Left with message from email adapter', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });
  });

  describe('when email rate limit has been reached for that email address', () => {
    it.todo('does not send any emails');
    it.todo('returns Left with message from rate limiter');
  });
});
