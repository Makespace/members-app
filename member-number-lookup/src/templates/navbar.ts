import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html} from '../types/html';
import {User} from '../types';

export const navbar = (user: O.Option<User>) =>
  pipe(
    user,
    O.match(
      () => html`<a href="/log-in">Log in</a>`,
      loggedInUser =>
        html`
          <span>${loggedInUser.memberNumber}</span>
          <a href="/log-out">Log out</a>
        `
    ),
    navItems => html`
      <nav class="page-nav">
        <a href="/"
          ><img
            src="/static/MS-LOGO-txpt-512.png"
            alt="Makespace"
            class="page-nav__logo"
        /></a>
        ${navItems}
      </nav>
    `
  );
