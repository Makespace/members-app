import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EmailAddress, Failure, failure} from '../../src/types';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';
import {sendLogInLink} from '../../src/authentication/send-log-in-link';
import {Config} from '../../src/configuration';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {Dependencies} from '../../src/dependencies';
import { LinkNumberToEmail } from '../../src/commands/member-numbers/link-number-to-email';
import { getRightOrFail } from '../helpers';

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

  describe('when an email is uniquely linked to a member number', () => {
    const member: LinkNumberToEmail = {
      email: emailAddress,
      memberNumber,
      name: undefined,
      formOfAddress: undefined,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(member);
    });

    describe('tried to login with the correct email address', () => {
      beforeEach(async () => {
        getRightOrFail(await sendLogInLink(deps, conf)(emailAddress)());
      });
      it('tries to send an email with a link', async () => {
        expect(deps.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipient: emailAddress,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            text: expect.stringContaining('token='),
          })
        );
      });
    });

    describe('when another email is linked to another member number', () => {
      const member2: LinkNumberToEmail = {
        email: faker.internet.email() as EmailAddress,
        memberNumber: faker.number.int(),
        name: undefined,
        formOfAddress: undefined,
      };
      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(member2);
      });
      describe('tried to login with the correct email address for the first member', () => {
        beforeEach(async () => {
          getRightOrFail(await sendLogInLink(deps, conf)(emailAddress)());
        });
        it('tries to send an email with a link', async () => {
          expect(deps.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              recipient: emailAddress,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              text: expect.stringContaining('token='),
            })
          );
        });
      });
      describe('tried to login with the correct email address for the second member', () => {
        beforeEach(async () => {
          getRightOrFail(await sendLogInLink(deps, conf)(member2.email)());
        });
        it('tries to send an email with a link', async () => {
          expect(deps.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              recipient: member2.email,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              text: expect.stringContaining('token='),
            })
          );
        });
      });
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
