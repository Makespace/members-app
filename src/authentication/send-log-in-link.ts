import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {EmailAddress, Failure, failure} from '../types';
import {Config} from '../configuration';
import {magicLink} from '.';
import {queries} from '../queries';

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

const lookupMemberNumber = (emailAddress: string) =>
  flow(
    queries.members.lookupByEmail(emailAddress),
    E.fromOption(() => failure('No member associated with that email')())
  );

export const sendLogInLink: SedLogInLink = (deps, conf) => emailAddress =>
  pipe(
    deps.getAllEvents(),
    TE.chainEitherK(lookupMemberNumber(emailAddress)),
    TE.map(memberNumber => ({memberNumber, emailAddress})),
    TE.map(magicLink.create(conf)),
    TE.map(toEmail(emailAddress)),
    TE.chain(deps.rateLimitSendingOfEmails),
    TE.chain(deps.sendEmail),
    TE.map(() => `Sent login link to ${emailAddress}`)
  );
