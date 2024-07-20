import {html, sanitizeString} from '../types/html';

export const checkYourMailPage = (submittedEmailAddress: string) => html`
  <h1>Check your mail</h1>
  <p>
    If <b>${sanitizeString(submittedEmailAddress)}</b> is linked to a Makespace
    number you should receive an email with that number.
  </p>
  <p>If nothing happens please reach out to the Makespace Database Team.</p>
`;
