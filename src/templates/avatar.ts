import {createHash} from 'crypto';
import {html, Safe, safe} from '../types/html';

function getGravatarUrl(email: string, size: number = 160) {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = createHash('sha256').update(trimmedEmail).digest('hex');
  return safe(`https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`);
}

type GravatarViewModel = {
  url1x: Safe;
  url2x: Safe;
  url4x: Safe;
  memberNumber: number;
};

const gravatar =
  (width: number, height: number) => (viewModel: GravatarViewModel) => html`
    <img
      width="${width}"
      height="${height}"
      srcset="
        ${safe(viewModel.url1x)} 1x,
        ${safe(viewModel.url2x)} 2x,
        ${safe(viewModel.url4x)} 4x
      "
      src="${safe(viewModel.url1x)}"
      alt="The avatar of ${viewModel.memberNumber}"
    />
  `;

export const getGravatarThumbnail = (email: string, memberNumber: number) =>
  gravatar(
    40,
    40
  )({
    url1x: getGravatarUrl(email, 40),
    url2x: getGravatarUrl(email, 80),
    url4x: getGravatarUrl(email, 160),
    memberNumber,
  });

export const getGravatarProfile = (email: string, memberNumber: number) =>
  gravatar(
    320,
    320
  )({
    url1x: getGravatarUrl(email, 320),
    url2x: getGravatarUrl(email, 640),
    url4x: getGravatarUrl(email, 1280),
    memberNumber,
  });
