import { gravatarHashFromEmail } from '../read-models/avatar';
import {User} from '../types';
import {html} from '../types/html';
import {getGravatarNavigationThumbnail} from './avatar';

// TODO consider allowing users to specify what email is used for gravatar.
// For now we just use the email provided.
export const loggedInUserSquare = (member: User) => html`
  <a
    class="page-nav__profile-link"
    href="/me"
    aria-label="Your profile"
    data-page-nav-toggle="profile"
    aria-expanded="false"
    aria-controls="page-nav-profile-panel"
  >
    ${getGravatarNavigationThumbnail(
      gravatarHashFromEmail(member.emailAddress)
    )}
  </a>
`;
