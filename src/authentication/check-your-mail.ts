import Handlebars from 'handlebars';
import {isolatedPageTemplate} from '../templates/page-template';

const CHECK_YOUR_MAIL_TEMPLATE = Handlebars.compile(
  `
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
