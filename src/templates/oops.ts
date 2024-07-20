import {html, HtmlSubstitution} from '../types/html';

export const oopsPage = (message: HtmlSubstitution) => html`
  <h1>Sorry, we have encountered a problem</h1>
  <p>${message}</p>
  <p>
    Please try again. If the problem persists please reach out in the google
    group.
  </p>
`;
