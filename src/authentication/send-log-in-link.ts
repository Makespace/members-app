import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {Email, EmailAddress, Failure, failure} from '../types';
import {Config} from '../configuration';
import {magicLink} from '.';
import mjml2html from 'mjml';
import {normaliseEmailAddress} from '../read-models/shared-state/normalise-email-address';
import * as O from 'fp-ts/Option';

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

export const sendLogInLink = (
  deps: Pick<Dependencies, 'sendEmail' | 'rateLimitSendingOfEmails' | 'sharedReadModel' | 'logger'>,
  conf: Config
) => (emailAddress: EmailAddress): TE.TaskEither<Failure, string> => {
  const members = deps.sharedReadModel.members.findByEmail(emailAddress);
  if (members.length === 0) {
    return TE.left(failure('No member associated with that email')());
  }
  if (members.length > 1) {
    deps.logger.error('While looking for email %s we found multiple users!', emailAddress);
    return TE.left(failure('Multiple members associated with that email. Please contact an administrator.')());
  }
  const matchedEmail = pipe(
    members[0].emails,
    emails =>
      emails.find(
        memberEmail =>
          memberEmail.emailAddress === normaliseEmailAddress(emailAddress)
      ),
    O.fromNullable,
    O.getOrElseW(() => {
      throw new Error('Expected matched verified email to be present on member');
    }),
    email => email.emailAddress
  );
  // Note that we intentionally use the stored email address rather than the one provided.
  // This prevents attacks where you specify an email address that somehow matches to an existing user but isn't
  // actually treated the same by the mailserver(s) so gets routed differently (to the attacker).
  const email = toEmail(matchedEmail)(
    magicLink.create(conf)({
      emailAddress: matchedEmail,
      memberNumber: members[0].memberNumber,
    })
  );
  return pipe(
    deps.rateLimitSendingOfEmails(email),
    TE.chain(deps.sendEmail),
    TE.map(() => `Sent login link to ${matchedEmail}`)
  );
}
