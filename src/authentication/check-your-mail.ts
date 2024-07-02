import * as O from 'fp-ts/Option';
import {pageTemplate} from '../templates';
import Handlebars from 'handlebars';

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
  pageTemplate(
    'Check your mail',
    O.none
  )(
    new Handlebars.SafeString(
      CHECK_YOUR_MAIL_TEMPLATE({
        submittedEmailAddress,
      })
    )
  );
