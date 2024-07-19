import {isolatedPageTemplate} from '../templates/page-template';
import { html } from '../types/html';

const CHECK_YOUR_MAIL_TEMPLATE = html`
      <h1>Check your mail</h1>
      <p>
        If <b>{{submittedEmailAddress}}</b> is linked to a Makespace number you
        should receive an email with that number.
      </p>
      <p>If nothing happens please reach out to the Makespace Database Team.</p>
    `
);

export const checkYourMailPage = (submittedEmailAddress: string) =>
  isolatedPageTemplate('Check your mail')(
    new Handlebars.SafeString(
      CHECK_YOUR_MAIL_TEMPLATE({
        submittedEmailAddress,
      })
    )
  );
