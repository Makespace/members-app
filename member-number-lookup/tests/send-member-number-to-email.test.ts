import {faker} from '@faker-js/faker';
import {sendMemberNumberToEmail} from '../src/send-member-number-to-email';
import * as TE from 'fp-ts/TaskEither';

describe('send-member-number-to-email', () => {
  describe.skip('when the email can be uniquely linked to a member number', () => {
    const email = faker.internet.email();
    const memberNumber = faker.datatype.number();
    const adapters = {
      sendMemberNumberEmail: jest.fn(),
      getMemberNumberForEmail: () => TE.right([memberNumber]),
    };

    sendMemberNumberToEmail(adapters)(email);

    it('tries to send an email with the number', () => {
      expect(adapters.sendMemberNumberEmail).toHaveBeenCalledWith([
        email,
        memberNumber,
      ]);
    });
  });

  describe('when the email is used by multiple member numbers', () => {
    it.todo('does not send any emails');
    it.todo('logs an error');
  });

  describe('when the submitted email has different capitalisation from one that can be uniquely linked to a member number', () => {
    it.todo('tries to send an email with the number');
  });

  describe('when database query fails', () => {
    it.todo('logs an error');
  });

  describe('when email fails to send', () => {
    it.todo('logs an error');
  });
});
