import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {EmailAddress, Failure} from '../types';
import jwt from 'jsonwebtoken';

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
  deps: Dependencies
) => (emailAddress: EmailAddress) => TE.TaskEither<Failure, string>;

export const sendLogInLink: SedLogInLink = ports => emailAddress =>
  pipe(
    emailAddress,
    ports.getMemberNumber,
    TE.map(memberNumber => ({memberNumber, emailAddress})),
    TE.map(tokenContent => jwt.sign(tokenContent, 'secret')),
    TE.map(token => `http://localhost:8080/auth/callback?token=${token}`),
    TE.map(toEmail(emailAddress)),
    TE.chain(ports.rateLimitSendingOfEmails),
    TE.chain(ports.sendEmail),
    TE.map(() => `Sent log in link to ${emailAddress}`)
  );
