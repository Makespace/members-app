import faker from '@faker-js/faker';
import {Email, EmailAddress, Failure} from '../../src/types';
import * as E from 'fp-ts/Either';
import {createRateLimiter} from '../../src/adapters/rate-limit-sending-of-emails';
import * as T from 'fp-ts/Task';

describe('rate-limit-sending-of-emails', () => {
  const email = {
    recipient: faker.internet.email() as EmailAddress,
    subject: faker.lorem.lines(1),
    message: faker.lorem.paragraph(),
  };

  describe('when the recipient has been sent less than the limit of emails in the current timewindow', () => {
    let result: E.Either<Failure, Email>;
    beforeEach(async () => {
      result = await createRateLimiter(1, 10)(email)();
    });

    it('returns the input email on the Right', () => {
      expect(result).toStrictEqual(E.right(email));
    });
  });

  describe('when the recipient has already been sent the limit of emails in current timewindow', () => {
    const rateLimiter = createRateLimiter(3, 10);
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

  describe('when the recipient was sent the limit of emails in the past, but not in the current time window', () => {
    const rateLimiter = createRateLimiter(1, 1);
    let result: E.Either<Failure, Email>;
    beforeEach(async () => {
      await rateLimiter(email)();
      await T.delay(1000)(T.of(''))();
      result = await rateLimiter(email)();
    });

    it('returns the input email on the Right', () => {
      expect(result).toStrictEqual(E.right(email));
    });
  });
});
