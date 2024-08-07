import {User} from '../types';
import {html} from '../types/html';
import {gravatarHashFromEmail} from '../read-models/members/avatar';
import {getGravatarThumbnail} from './avatar';

export const loggedInUserSquare = (member: User) => html`
  <a href="/me">
    ${getGravatarThumbnail(
      gravatarHashFromEmail(member.emailAddress),
      member.memberNumber
    )}
  </a>
`;
