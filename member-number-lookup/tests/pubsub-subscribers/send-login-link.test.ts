import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EmailAddress, Failure, failure} from '../../src/types';
import {happyPathAdapters} from '../adapters/happy-path-adapters.helper';
import {sendLogInLink} from '../../src/authentication/send-log-in-link';
import {Config} from '../../src/configuration';

describe('send-log-in-link', () => {
  const emailAddress = faker.internet.email() as EmailAddress;
  const memberNumber = faker.number.int();
  const conf = {TOKEN_SECRET: 'secret'} as Config;

  describe('when the email can be uniquely linked to a member number', () => {
    const deps = {
      ...happyPathAdapters,
      getMemberNumber: () => TE.right(memberNumber),
      sendEmail: jest.fn(() => TE.right('success')),
    };

    beforeEach(async () => {
      await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('tries to send an email with a link', () => {
      expect(deps.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: emailAddress,
          message: expect.stringContaining('token='),
        })
      );
    });
  });

  describe('when database query fails', () => {
    const errorMsg = 'db query failed';
    const deps = {
      ...happyPathAdapters,
      getMemberNumber: () => TE.left(failure(errorMsg)({})),
      sendEmail: jest.fn(() => TE.right('success')),
    };

    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      result = await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('does not send any emails', () => {
      expect(deps.sendEmail).not.toHaveBeenCalled();
    });

    it('return on Left with message from db adapter', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });
  });

  describe('when email fails to send', () => {
    const errorMsg = 'sending of email failed';
    const deps = {
      ...happyPathAdapters,
      sendEmail: () => TE.left(failure(errorMsg)()),
    };

    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      result = await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('returns Left with message from email adapter', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });
  });
});