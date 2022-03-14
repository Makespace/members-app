import {faker} from '@faker-js/faker';
import {sendMemberNumberToEmail} from '../src/pubsub-subscribers/send-member-number-to-email';
import * as TE from 'fp-ts/TaskEither';
import {EmailAddress} from '../src/types/email-address';
import * as E from 'fp-ts/Either';
import {Failure, failure} from '../src/types';

describe('send-member-number-to-email', () => {
  const email = faker.internet.email() as EmailAddress;
  const memberNumber = faker.datatype.number();

  describe('when the email can be uniquely linked to a member number', () => {
    const adapters = {
      getMemberNumber: () => TE.right(memberNumber),
      sendEmail: jest.fn(() => TE.right('success')),
    };

    beforeEach(async () => {
      await sendMemberNumberToEmail(adapters)(email)();
    });

    it('tries to send an email with the number', () => {
      expect(adapters.sendEmail).toHaveBeenCalledWith(
        email,
        expect.stringContaining(memberNumber.toString())
      );
    });
  });

  describe('when database query fails', () => {
    const errorMsg = 'db query failed';
    const adapters = {
      getMemberNumber: () => TE.left(failure(errorMsg)({})),
      sendEmail: jest.fn(() => TE.right('success')),
    };

    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(email)();
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
      sendEmail: () => TE.left(failure(errorMsg)()),
    };

    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(email)();
    });

    it('returns Left with message from email adapter', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });
  });
});
