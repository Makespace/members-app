import {pipe} from 'fp-ts/lib/function';
import {html} from './shared/html';
import {pageTemplateNoNav} from './shared/page-template-no-nav';

export const logInPage = pipe(
  html`
    <h1>Log in</h1>
    <form action="/auth" method="post">
      <label for="email">E-Mail: </label>
      <input id="email" type="email" required name="email" value="" />
      <p>We will email you a magic log in link.</p>
      <input type="submit" value="Email me a link" />
    </form>
  `,
  pageTemplateNoNav('Member Number Lookup')
);
