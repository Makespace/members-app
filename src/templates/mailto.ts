import * as O from 'fp-ts/Option';
import {EmailAddress} from '../types';
import {html, Html, safe, sanitizeString} from '../types/html';

const mailtoLink = (
  email: EmailAddress,
  subject: O.Option<string>,
  body: O.Option<string>
): Html => {
  const encodedEmail = safe(encodeURIComponent(email));
  const query: Html[] = [];

  if (O.isSome(subject)) {
    query.push(html`subject=${safe(encodeURIComponent(subject.value))}`);
  }

  if (O.isSome(body)) {
    query.push(html`body=${safe(encodeURIComponent(body.value))}`);
  }

  const querySeperator =
    O.isSome(subject) || O.isSome(body) ? html`?` : html``;
  const queryPart = safe(query.join('&'));

  return html`mailto:${encodedEmail}${querySeperator}${queryPart}`;
};

export const mailTo = (
  email: EmailAddress,
  subject: O.Option<string>,
  body: O.Option<string>
): Html => html`
  <a href="${mailtoLink(email, subject, body)}">
    ${sanitizeString(email)}
  </a>
`;
