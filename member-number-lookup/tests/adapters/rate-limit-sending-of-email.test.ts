import faker from '@faker-js/faker';
import {Email, EmailAddress, Failure} from '../../src/types';
import * as E from 'fp-ts/Either';
import {rateLimitSendingOfEmails} from '../../src/adapters/rate-limit-sending-of-emails';

describe('rate-limit-sending-of-emails', () => {
  const email = {
    recipient: faker.internet.email() as EmailAddress,
    subject: faker.lorem.lines(1),
    message: faker.lorem.paragraph(),
  };

  describe('when the recipient has not been sent any emails yet', () => {
    let result: E.Either<Failure, Email>;
    beforeEach(async () => {
      result = await rateLimitSendingOfEmails(1)(email)();
    });

    it('returns the input email on the Right', () => {
      expect(result).toStrictEqual(E.right(email));
    });
  });

  describe('when the recipient has been sent less than the limit of emails in the past 24h', () => {
    it.todo('returns the input email on the Right');
  });

  describe('when the recipient has already been sent the limit of emails in the past 24h', () => {
    const rateLimiter = rateLimitSendingOfEmails(3);
    let result: E.Either<Failure, Email>;
    beforeEach(async () => {
      await rateLimiter(email)();
      await rateLimiter(email)();
      await rateLimiter(email)();
      result = await rateLimiter(email)();
    });

    it('returns on Left', () => {
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('when the recipient was sent the limit of emails in the past, but not in the current 24h', () => {
    it.todo('returns the input email on the Right');
  });
});
