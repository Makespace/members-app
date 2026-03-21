import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {EmailAddress, Failure, failure} from '../../src/types';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';
import {sendLogInLink} from '../../src/authentication/login/send-log-in-link';
import {Config} from '../../src/configuration';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {Dependencies} from '../../src/dependencies';
import {LinkNumberToEmail} from '../../src/commands/member-numbers/link-number-to-email';
import {getRightOrFail} from '../helpers';

describe('send-log-in-link', () => {
  const emailAddress = faker.internet.email() as EmailAddress;
  const memberNumber = faker.number.int();
  const conf = {
    TOKEN_SECRET: 'secret',
    PUBLIC_URL: 'https://members.makespace.example',
  } as Config;

  let framework: TestFramework;
  let deps: Pick<
    Dependencies,
    'sendEmail' | 'sharedReadModel' | 'rateLimitSendingOfEmails' | 'logger'
  >;
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
      let result: string;

      beforeEach(async () => {
        result = getRightOrFail(await sendLogInLink(deps, conf)(emailAddress)());
      });

      it('tries to send an email with a link', () => {
        expect(deps.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipient: emailAddress,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            text: expect.stringContaining('token='),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            html: expect.stringContaining(
              `${conf.PUBLIC_URL}/auth/landing?token=`
            ),
          })
        );
      });

      it('returns success message with the requested email address', () => {
        expect(result).toStrictEqual(`Sent login link to ${emailAddress}`);
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
      describe('tried to login with the correct email address for the second member', () => {
        beforeEach(async () => {
          getRightOrFail(await sendLogInLink(deps, conf)(member2.email)());
        });
        it('tries to send an email with a link', () => {
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

    describe('tried to login with the matching email address using different domain casing', () => {
      const emailAddressWithUpperCaseDomain = emailAddress.replace(
        /@(.+)$/,
        (_, domain: string) => `@${domain.toUpperCase()}`
      ) as EmailAddress;
      let result: string;

      beforeEach(async () => {
        result = getRightOrFail(
          await sendLogInLink(deps, conf)(emailAddressWithUpperCaseDomain)()
        );
      });

      it('sends the email to the stored email address', () => {
        expect(deps.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            recipient: emailAddress,
          })
        );
      });

      it('returns success message with the stored email address (not the different domain casing)', () => {
        // This makes it more obvious to users that we normalise the email addresses.
        expect(result).toStrictEqual(`Sent login link to ${emailAddress}`);
      });
    });

    describe('when no member is associated with the email address', () => {
      let result: E.Either<Failure, string>;

      beforeEach(async () => {
        result = await sendLogInLink(deps, conf)(faker.internet.email() as EmailAddress)();
      });

      it('returns Left describing the missing member', () => {
        expect(result).toStrictEqual(
          E.left(
            expect.objectContaining({
              message: 'No member associated with that email',
            })
          )
        );
      });

      it('does not try to send an email', () => {
        expect(deps.sendEmail).not.toHaveBeenCalled();
      });
    });

    describe('when the member has an additional email address', () => {
      const secondaryEmail = faker.internet.email() as EmailAddress;

      beforeEach(async () => {
        await framework.commands.members.addEmail({
          memberNumber,
          email: secondaryEmail,
        });
      });

      it('does not allow login with an unverified additional email', async () => {
        const result = await sendLogInLink(deps, conf)(secondaryEmail)();
        expect(result).toStrictEqual(
          E.left(
            expect.objectContaining({
              message: 'No member associated with that email',
            })
          )
        );
      });

      describe('and that additional email has been verified', () => {
        beforeEach(async () => {
          await framework.commands.members.verifyEmail({
            memberNumber,
            emailAddress: secondaryEmail,
          });
        });

        it('sends the login email to the matched verified address', async () => {
          const result = getRightOrFail(
            await sendLogInLink(deps, conf)(secondaryEmail)()
          );

          expect(deps.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              recipient: secondaryEmail,
            })
          );
          expect(result).toStrictEqual(`Sent login link to ${secondaryEmail}`);
        });
      });
    });
  });

  describe('when no member are setup', () => {
    let result: E.Either<Failure, string>;

    beforeEach(async () => {
      result = await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('returns Left describing the missing member', () => {
      expect(result).toStrictEqual(
        E.left(
          expect.objectContaining({
            message: 'No member associated with that email',
          })
        )
      );
    });

    it('does not try to send an email', () => {
      expect(deps.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('when rate limiting blocks the login email', () => {
    const errorMsg = 'too many login emails sent';
    let result: E.Either<Failure, string>;

    beforeEach(async () => {
      deps.rateLimitSendingOfEmails = () => TE.left(failure(errorMsg)());
      await framework.commands.memberNumbers.linkNumberToEmail({
        email: emailAddress,
        memberNumber,
        name: undefined,
        formOfAddress: undefined,
      });
      result = await sendLogInLink(deps, conf)(emailAddress)();
    });

    it('returns Left with the rate limiting error', () => {
      expect(result).toStrictEqual(
        E.left(expect.objectContaining({message: errorMsg}))
      );
    });

    it('does not try to send an email', () => {
      expect(deps.sendEmail).not.toHaveBeenCalled();
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
