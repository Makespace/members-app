import {Member} from '../types';
import {html} from '../types/html';
import {getGravatarThumbnail} from './avatar';

export const loggedInUserSquare = (member: Member) => html`
  <a href="/me">
    ${getGravatarThumbnail(member.emailAddress, member.memberNumber)}
  </a>
`;
