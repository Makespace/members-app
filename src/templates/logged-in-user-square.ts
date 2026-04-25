import { gravatarHashFromEmail } from '../read-models/avatar';
import {User} from '../types';
import {html} from '../types/html';
import {getGravatarThumbnail} from './avatar';

// TODO consider allowing users to specify what email is used for gravatar.
// For now we just use the email provided.
export const loggedInUserSquare = (member: User) => html`
  <a href="/me">
    ${getGravatarThumbnail(
      gravatarHashFromEmail(member.emailAddress),
      member.memberNumber
    )}
  </a>
`;
