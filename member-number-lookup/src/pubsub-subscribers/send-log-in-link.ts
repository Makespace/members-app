import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {EmailAddress, Failure} from '../types';
import {Config} from '../configuration';
import {magicLink} from '../authentication';

const toEmail = (emailAddress: EmailAddress) => (magicLink: string) => ({
  recipient: emailAddress,
  subject: 'Log in link for Makespace',
  message: `
      Hi,

      Complete logging in to Makespace by opening the link below:

      ${magicLink}
    `,
});

type SedLogInLink = (
  deps: Dependencies,
  conf: Config
) => (emailAddress: EmailAddress) => TE.TaskEither<Failure, string>;

export const sendLogInLink: SedLogInLink = (deps, conf) => emailAddress =>
  pipe(
    emailAddress,
    deps.getMemberNumber,
    TE.map(memberNumber => ({memberNumber, emailAddress})),
    TE.map(magicLink.create(conf)),
    TE.map(toEmail(emailAddress)),
    TE.chain(deps.rateLimitSendingOfEmails),
    TE.chain(deps.sendEmail),
    TE.map(() => `Sent log in link to ${emailAddress}`)
  );
