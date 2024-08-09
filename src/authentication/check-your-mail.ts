import {pipe} from 'fp-ts/lib/function';
import {isolatedPageTemplate} from '../templates/page-template';
import {html, safe, sanitizeString} from '../types/html';

export const checkYourMailPage = (submittedEmailAddress: string) =>
  pipe(
    html`
      <h1>Check your mail</h1>
      <p>
        If <b>${sanitizeString(submittedEmailAddress)}</b> is linked to a
        Makespace number you should receive an email with that number.
      </p>
      <p>
        If nothing happens within 10 minutes please reach out to the Makespace
        Database Team.
      </p>
    `,
    isolatedPageTemplate(safe('Check your mail'))
  );
