import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from './page-template';
import {User} from '../authentication';
import {html} from './html';

export const profilePage = (user: User) =>
  pipe(
    html`
      <h1>Your member profile</h1>
      <dl>
        <dt>Email</dt>
        <dd>${user.emailAddress}</dd>
        <dt>Member Number</dt>
        <dd>${user.memberNumber}</dd>
      </dl>
    `,
    pageTemplate('Member Number Lookup')
  );
