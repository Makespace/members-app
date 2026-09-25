import {pipe} from 'fp-ts/lib/function';
import {isolatedPageTemplate} from '../../templates/page-template';
import {html, safe, sanitizeString} from '../../types/html';
import {LogInIdentifier} from './log-in-identifier';
import {normaliseEmailAddress} from '../../read-models/shared-state/normalise-email-address';

// What the page says about a member number is deliberately vague: naming the
// address on file would turn the login form into a way of looking up any
// member's email address by guessing at numbers.
export const checkYourMailPage = (identifier: LogInIdentifier) =>
  pipe(
    html`
      <h1>Check your mail</h1>
      <p>
        ${identifier.tag === 'email'
          ? html`If
              <b
                >${sanitizeString(
                  normaliseEmailAddress(identifier.email)
                )}</b
              >
              is linked to a Makespace number you should receive an email with
              that number.`
          : html`If <b>${safe(String(identifier.memberNumber))}</b> is a
              Makespace member number, a log in link is on its way to the
              email address we hold for it.`}
      </p>
      <p>
        If nothing happens within 10 minutes please reach out to the Makespace
        Database Team.
      </p>
    `,
    isolatedPageTemplate(safe('Check your mail'))
  );
