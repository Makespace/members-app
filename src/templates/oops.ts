import {pipe} from 'fp-ts/lib/function';
import {html, HtmlSubstitution, safe} from '../types/html';
import {isolatedPageTemplate} from './page-template';

export const oopsPage = (message: HtmlSubstitution) =>
  pipe(
    html`
      <h1>Sorry, we have encountered a problem</h1>
      <p>${message}</p>
      <p>
        Please try again. If the problem persists please reach out in the google
        group.
      </p>
    `,
    isolatedPageTemplate(safe('Oops'))
  );
