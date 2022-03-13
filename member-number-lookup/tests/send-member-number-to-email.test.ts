import {faker} from '@faker-js/faker';
import {sendMemberNumberToEmail} from '../src/send-member-number-to-email';
import * as TE from 'fp-ts/TaskEither';
import {Email} from '../src/types/email';
import * as E from 'fp-ts/Either';

describe('send-member-number-to-email', () => {
  const email = faker.internet.email() as Email;
  const memberNumber = faker.datatype.number();
  const errorMsg = 'reason for failure';

  const happyPathAdapters = {
    sendMemberNumberEmail: jest.fn(() => TE.right(undefined)),
    getMemberNumberForEmail: () => TE.right(memberNumber),
  };

  let result: E.Either<string, string>;
  describe('when the email can be uniquely linked to a member number', () => {
    const adapters = happyPathAdapters;

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
    const adapters = {
      ...happyPathAdapters,
      getMemberNumberForEmail: () => TE.left(errorMsg),
    };

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
    const adapters = {
      ...happyPathAdapters,
      sendMemberNumberEmail: () => TE.left(errorMsg),
    };

    beforeEach(async () => {
      result = await sendMemberNumberToEmail(adapters)(email)();
    });

    it('returns Left with message from email adapter', () => {
      expect(result).toStrictEqual(E.left(errorMsg));
    });
  });
});
