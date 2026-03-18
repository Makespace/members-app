import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import mjml2html from 'mjml';
import {Config} from '../../configuration';
import {Dependencies} from '../../dependencies';
import {Email, EmailAddress, Failure} from '../../types';
import {emailVerificationLink} from './email-verification-link';

const toEmail =
  (emailAddress: EmailAddress) =>
  (verificationLink: string): Email => ({
    recipient: emailAddress,
    subject: 'Verify your Makespace email address',
    text: `
      Hi,

      Verify this email address for your Makespace account by opening the link below:

      ${verificationLink}
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
            <mj-text font-size="20px" line-height="1.3" color="#111" align="center">
              Verify this email address for your Makespace account
            </mj-text>
            <mj-button
              color="#111"
              background-color="#7FC436"
              href="${verificationLink}"
              font-weight="800"
            >
              Verify email
            </mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
    `).html,
  });

export const sendEmailVerification = (
  deps: Pick<Dependencies, 'sendEmail' | 'rateLimitSendingOfEmails'>,
  conf: Config
) => (memberNumber: number, emailAddress: EmailAddress): TE.TaskEither<Failure, string> => {
  const email = toEmail(emailAddress)(
    emailVerificationLink.create(conf)({
      memberNumber,
      emailAddress,
    })
  );
  return pipe(
    deps.rateLimitSendingOfEmails(email),
    TE.chain(deps.sendEmail),
    TE.map(() => `Sent email verification to ${emailAddress}`)
  );
};
