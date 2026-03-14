import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EmailAddress, Failure, failure} from '../../src/types';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';
import {sendLogInLink} from '../../src/authentication/send-log-in-link';
import {Config} from '../../src/configuration';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {Dependencies} from '../../src/dependencies';

describe('send-log-in-link', () => {
  const emailAddress = faker.internet.email() as EmailAddress;
  const memberNumber = faker.number.int();
  const conf = {TOKEN_SECRET: 'secret'} as Config;

  let framework: TestFramework;
  let deps: Pick<Dependencies, 'sendEmail' | 'sharedReadModel' | 'rateLimitSendingOfEmails' | 'logger'>;
  beforeEach(async () => {
    framework = await initTestFramework();
    deps = {
      ...happyPathAdapters,
      sendEmail: jest.fn(() => TE.right('success')),
      sharedReadModel: framework.sharedReadModel,
    };
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the email is uniquely linked to a member number', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        email: emailAddress,
        memberNumber,
        name: undefined,
        formOfAddress: undefined,
      });
      await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('tries to send an email with a link', () => {
      expect(deps.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: emailAddress,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          text: expect.stringContaining('token='),
        })
      );
    });
  });

  describe('when email fails to send', () => {
    const errorMsg = 'sending of email failed';
    let result: E.Either<Failure, string>;
    beforeEach(async () => {
      deps.sendEmail = () => TE.left(failure(errorMsg)());
      await framework.commands.memberNumbers.linkNumberToEmail({
        email: emailAddress,
        memberNumber,
        name: undefined,
        formOfAddress: undefined,
      });
      result = await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('returns Left with message from email adapter', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });
  });
});
