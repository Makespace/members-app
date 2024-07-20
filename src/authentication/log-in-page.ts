import {pipe} from 'fp-ts/lib/function';
import {html} from '../types/html';
import {isolatedPageTemplate} from '../templates/page-template';

export const logInPage = pipe(
  html`
    <h1>Log in</h1>
    <form action="/auth" method="post">
      <label for="email">E-Mail: </label>
      <input id="email" type="email" required name="email" value="" />
      <p>We will email you a magic log in link.</p>
      <button type="submit">Email me a link</button>
    </form>
  `,
  isolatedPageTemplate('Login')
);
