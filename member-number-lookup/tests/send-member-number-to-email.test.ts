import {faker} from '@faker-js/faker';
import {sendMemberNumberToEmail} from '../src/send-member-number-to-email';
import * as TE from 'fp-ts/TaskEither';
import {Email} from '../src/email';

describe('send-member-number-to-email', () => {
  describe('when the email can be uniquely linked to a member number', () => {
    const email = faker.internet.email() as Email;
    const memberNumber = faker.datatype.number();
    const adapters = {
      sendMemberNumberEmail: jest.fn(() => TE.right(undefined)),
      getMemberNumberForEmail: () => TE.right(memberNumber),
    };

    beforeEach(async () => {
      await sendMemberNumberToEmail(adapters)(email);
    });

    it('tries to send an email with the number', () => {
      expect(adapters.sendMemberNumberEmail).toHaveBeenCalledWith(
        email,
        memberNumber
      );
    });
  });

  describe('when the email has no matches in database', () => {
    const email = faker.internet.email() as Email;
    const adapters = {
      sendMemberNumberEmail: jest.fn(() => TE.right(undefined)),
      getMemberNumberForEmail: () => TE.left('no member number found'),
    };

    beforeEach(async () => {
      await sendMemberNumberToEmail(adapters)(email);
    });
    it('does not send any emails', () => {
      expect(adapters.sendMemberNumberEmail).not.toHaveBeenCalled();
    });
    it.todo('logs an info');
  });

  describe('when database query fails', () => {
    it.todo('does not send any emails');
    it.todo('logs an error');
  });

  describe('when email fails to send', () => {
    it.todo('does not send any emails');
    it.todo('logs an error');
  });
});
