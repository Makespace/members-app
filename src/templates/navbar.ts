import {Member} from '../types';
import {html} from '../types/html';
import {loggedInUserSquare} from './logged-in-user-square';

export const navBar = (member: Member) => html`
  <nav class="page-nav">
    <a href="/"
      ><img
        width="64"
        height="64"
        src="/static/MS-LOGO-txpt-512.png"
        alt="Makespace"
        class="page-nav__logo"
    /></a>
    <a href="/members">Members</a>
    <a href="/equipment">Equipment</a>
    <a href="/areas">Areas</a>
    <a href="/log-out">Log out</a>
    ${loggedInUserSquare(member)}
  </nav>
`;
