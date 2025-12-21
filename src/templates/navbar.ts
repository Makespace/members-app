import {User} from '../types';
import {html} from '../types/html';
import {loggedInUserSquare} from './logged-in-user-square';

export const navBar = (user: User, isSuperUser: boolean) => html`
  <nav class="page-nav">
    <a class="jsonly page-nav__previous" href="#" onclick="history.back()"
      >Back</a
    >
    <a href="/"
      ><img
        width="64"
        height="64"
        src="/static/MS-LOGO-txpt-512.png"
        alt="Makespace"
        class="page-nav__logo"
    /></a>
    <div class="page-nav__inner">
      ${isSuperUser ? html`<a href="/admin">Admin</a>` : ''}
      <a href="/raise-issue">Raise an Issue</a>
      <a href="/equipment">Equipment</a>
      <a href="/log-out">Log out</a>
    </div>
    ${loggedInUserSquare(user)}
  </nav>
`;
