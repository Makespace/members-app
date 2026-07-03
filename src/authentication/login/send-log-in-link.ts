import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import {Email, EmailAddress, Failure, failure} from '../../types';
import {Config} from '../../configuration';
import {magicLink} from '..';
import mjml2html from 'mjml';
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
  // Match the typed email to a stored one case-insensitively (e.g. "joe@x.com"
  // finds a member registered as "Joe@x.com"). resolveEmailForLogin returns the
  // address exactly as stored, so we always send to the on-file casing.
  const storedEmail = deps.sharedReadModel.members.resolveEmailForLogin(
    emailAddress,
    true
  );
  if (O.isNone(storedEmail)) {
    return TE.left(failure('No member associated with that email')());
  }
  // Note that we intentionally use the stored email address rather than the one provided.
  // This prevents attacks where you specify an email address that somehow matches to an existing user but isn't
  // actually treated the same by the mailserver(s) so gets routed differently (to the attacker).
  const matchedEmail = storedEmail.value;
  const member = deps.sharedReadModel.members.getByEmail(matchedEmail, true);
  if (O.isNone(member)) {
    return TE.left(failure('No member associated with that email')());
  }
  const email = toEmail(matchedEmail)(
    magicLink.create(conf)({
      emailAddress: matchedEmail,
      memberNumber: member.value.memberNumber,
    })
  );
  return pipe(
    deps.rateLimitSendingOfEmails(email),
    TE.chain(deps.sendEmail),
    TE.map(() => `Sent login link to ${matchedEmail}`)
  );
}
