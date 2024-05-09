import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {Email, EmailAddress, Failure, failure} from '../types';
import {Config} from '../configuration';
import {magicLink} from '.';
import {queries} from '../queries';
import mjml2html from 'mjml';

const toEmail =
  (emailAddress: EmailAddress) =>
  (magicLink: string): Email => ({
    recipient: emailAddress,
    subject: 'Log in link for Makespace',
    text: `
      Hi,

      Complete logging in to Makespace by opening the link below:

      ${magicLink}
    `,
    html: mjml2html(`
    <mjml>
  <mj-body width="800px">
    <mj-section background-color="#fa990e">
      <mj-column>
        <mj-text align="center" color="#111" font-size="40px">MakeSpace</mj-text>
        <mj-text font-style="italic" align="center" color="#111" font-size="30px">Member App</mj-text>
      </mj-column>
    </mj-section>
    <mj-section>
      <mj-column width="400px">
        <mj-text font-size="20px" line-height="1.3" color="#111" align="center">Complete logging in by opening the link below
        </mj-text>
        <mj-text color="#111"></mj-text>
        <mj-button color="#111" background-color="#7FC436" href="${magicLink}" font-weight="800">Log in</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `).html,
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
