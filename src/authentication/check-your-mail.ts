import {pipe} from 'fp-ts/lib/function';
import {isolatedPageTemplate} from '../templates/page-template';
import {html, safe, sanitizeString} from '../types/html';
import {EmailAddress} from '../types';
import {normaliseEmailAddress} from '../read-models/shared-state/normalise-email-address';

export const checkYourMailPage = (submittedEmailAddress: EmailAddress) =>
  pipe(
    html`
      <h1>Check your mail</h1>
      <p>
        If <b>${sanitizeString(normaliseEmailAddress(submittedEmailAddress))}</b> is linked to a
        Makespace number you should receive an email with that number.
      </p>
      <p>
        If nothing happens within 10 minutes please reach out to the Makespace
        Database Team.
      </p>
    `,
    isolatedPageTemplate(safe('Check your mail'))
  );
