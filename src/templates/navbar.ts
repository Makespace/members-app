import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html} from '../types/html';
import {User} from '../types';

export const navbar = (user: O.Option<User>) =>
  pipe(
    user,
    O.match(
      () => html`<a href="/log-in">Log in</a>`,
      () => html` <a href="/log-out">Log out</a> `
    ),
    logInOut => html`
      <nav class="page-nav">
        <a href="/"
          ><img
            width=64
            height=64
            src="/static/MS-LOGO-txpt-512.png"
            alt="Makespace"
            class="page-nav__logo"
        /></a>
        <a href="/members">Members</a>
        <a href="/equipment">Equipment</a>
        <a href="/areas">Areas</a>
        ${logInOut}
      </nav>
    `
  );
