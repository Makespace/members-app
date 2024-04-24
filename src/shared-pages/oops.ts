import {pipe} from 'fp-ts/lib/function';
import {html} from '../types/html';
import {pageTemplateNoNav} from '../templates';

export const oopsPage = (message: string) =>
  pipe(
    html`
      <h1>Sorry, we have encountered a problem</h1>
      <p>${message}</p>
      <p>
        Please try again. If the problem persists please contact the Makespace
        Database owners.
      </p>
    `,
    pageTemplateNoNav('Member Number Lookup')
  );
