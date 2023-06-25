import {pipe} from 'fp-ts/lib/function';
import {html} from './html';
import {pageTemplateNoNav} from './page-template-no-nav';

export const landingPage = pipe(
  html`
    <h1>Lookup Your Member Number</h1>
    <form action="/send-member-number-by-email" method="post">
      <label for="email">E-Mail: </label>
      <input id="email" type="email" required name="email" value="" />
      <input type="submit" value="Send Member Number" />
    </form>
  `,
  pageTemplateNoNav('Member Number Lookup')
);
