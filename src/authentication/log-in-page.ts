import {pipe} from 'fp-ts/lib/function';
import {html, safe} from '../types/html';
import {isolatedPageTemplate} from '../templates/page-template';

export const logInPage = pipe(
  html`
    <h1>Log in</h1>
    <form action="/auth" method="post">
      <label for="email">E-Mail: </label>
      <input id="email" type="email" required name="email" value="" />
      <p>We will email you a magic log in link.</p>
      <p>
        A unique email will have been associated with your member records. This
        is probably the email you provided during induction.
      </p>
      <button type="submit">Email me a link</button>
    </form>
  `,
  isolatedPageTemplate(safe('MakeSpace Members App'))
);
