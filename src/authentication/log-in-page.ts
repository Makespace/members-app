import * as O from 'fp-ts/Option';
import {pageTemplate} from '../templates';

const LOGIN_PAGE_TEMPLATE = Handlebars.compile(
  `
  <h1>Log in</h1>
  <form action="/auth" method="post">
    <label for="email">E-Mail: </label>
    <input id="email" type="email" required name="email" value="" />
    <p>We will email you a magic log in link.</p>
    <button type="submit">Email me a link</button>
  </form>
  `
);

export const logInPage = pageTemplate(
  'MakeSpace Members App',
  O.none
)(LOGIN_PAGE_TEMPLATE);
