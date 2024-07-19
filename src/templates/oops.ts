import {html, sanitizeString} from '../types/html';

export const oopsPage = (message: string) => html`
  <h1>Sorry, we have encountered a problem</h1>
  <p>${sanitizeString(message)}</p>
  <p>
    Please try again. If the problem persists please reach out in the google
    group.
  </p>
`;
