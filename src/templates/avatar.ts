import {createHash} from 'crypto';
import {MemberDetails} from '../types';
import {html} from '../types/html';

function getGravatarUrl(email: string, size: number = 160) {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = createHash('sha256').update(trimmedEmail).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

export function renderAvatarThumbnail(member: MemberDetails) {
  const email = member.email;
  const url1x = getGravatarUrl(email, 40);
  const url2x = getGravatarUrl(email, 80);
  const url4x = getGravatarUrl(email, 160);
  return html`
    <img
      width="40"
      height="40"
      srcset="${url1x} 1x, ${url2x} 2x, ${url4x} 4x"
      src="${url1x}"
      alt="The avatar of ${member.number}"
    />
  `;
}

export function renderAvatarProfile(member: MemberDetails) {
  const email = member.email;
  const url1x = getGravatarUrl(email, 320);
  const url2x = getGravatarUrl(email, 640);
  const url4x = getGravatarUrl(email, 1280);
  return html`
    <img
      width="320"
      height="320"
      srcset="${url1x} 1x, ${url2x} 2x, ${url4x} 4x"
      src="${url1x}"
      alt="The avatar of ${member.number}"
    />
  `;
}
