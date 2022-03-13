import {faker} from '@faker-js/faker';
import {sendMemberNumberToEmail} from '../src/send-member-number-to-email';
import * as TE from 'fp-ts/TaskEither';
import {Email} from '../src/email';
import * as E from 'fp-ts/Either';

describe('send-member-number-to-email', () => {
  describe('when the email can be uniquely linked to a member number', () => {
    const email = faker.internet.email() as Email;
    const memberNumber = faker.datatype.number();
    const adapters = {
      sendMemberNumberEmail: jest.fn(() => TE.right(undefined)),
      getMemberNumberForEmail: () => TE.right(memberNumber),
    };

    beforeEach(async () => {
      await sendMemberNumberToEmail(adapters)(email)();
    });

    it('tries to send an email with the number', () => {
      expect(adapters.sendMemberNumberEmail).toHaveBeenCalledWith(
        email,
        memberNumber
      );
    });
  });

  describe('when database query fails', () => {
    const email = faker.internet.email() as Email;
    const errorMsg = 'reason for failure';
    const adapters = {
      sendMemberNumberEmail: jest.fn(() => TE.right(undefined)),
      getMemberNumberForEmail: () => TE.left(errorMsg),
    };

    let result: E.Either<string, string>;

    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(email)();
    });

    it('does not send any emails', () => {
      expect(adapters.sendMemberNumberEmail).not.toHaveBeenCalled();
    });

    it('return on Left with message from db adapter', () => {
      expect(result).toStrictEqual(E.left(errorMsg));
    });
  });

  describe('when email fails to send', () => {
    const email = faker.internet.email() as Email;
    const errorMsg = 'reason for failure';
    const adapters = {
      sendMemberNumberEmail: () => TE.left(errorMsg),
      getMemberNumberForEmail: () => TE.right(faker.datatype.number()),
    };

    let result: E.Either<string, string>;

    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(email)();
    });

    it('returns Left with message from email adapter', () => {
      expect(result).toStrictEqual(E.left(errorMsg));
    });
  });
});
