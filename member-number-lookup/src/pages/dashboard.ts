import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';
import {User} from '../authentication';
import {html} from './html';
import * as O from 'fp-ts/Option';

export const dashboardPage = (user: User) =>
  pipe(
    html`
      <h1>Makespace Member Dashboard</h1>
      <h2>Your Details</h2>
      <dl>
        <dt>Email</dt>
        <dd>${user.emailAddress}</dd>
        <dt>Member Number</dt>
        <dd>${user.memberNumber}</dd>
      </dl>
      <h2>Trainers</h2>
      <p>Work in progress...</p>
    `,
    pageTemplate('Member Number Lookup', O.some(user))
  );
