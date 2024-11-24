import {User} from '../types';
import {html} from '../types/html';
import {loggedInUserSquare} from './logged-in-user-square';

// eslint-disable-next-line unused-imports/no-unused-vars
export const navBar = (user: User, isSuperUser: boolean) => html`
  <nav class="page-nav">
    <a href="/"
      ><img
        width="64"
        height="64"
        src="/static/MS-LOGO-txpt-512.png"
        alt="Makespace"
        class="page-nav__logo"
    /></a>
    <div class="page-nav__inner">
      <a href="/raise-issue">Raise an Issue</a>
      <a href="/equipment">Equipment</a>
      <a href="/log-out">Log out</a>
    </div>
    ${loggedInUserSquare(user)}
  </nav>
`;
