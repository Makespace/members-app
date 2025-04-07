import {html, Safe, safe} from '../types/html';
import {GravatarHash, isoGravatarHash} from '../types';

function getGravatarUrl(hash: GravatarHash, size: number = 160) {
  const rawHash = isoGravatarHash.unwrap(hash);
  return safe(
    `https://www.gravatar.com/avatar/${rawHash}?s=${size}&d=identicon`
  );
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
      loading="lazy"
    />
  `;

export const getGravatarThumbnail = (
  hash: GravatarHash,
  memberNumber: number
) =>
  gravatar(
    40,
    40
  )({
    url1x: getGravatarUrl(hash, 40),
    url2x: getGravatarUrl(hash, 80),
    url4x: getGravatarUrl(hash, 160),
    memberNumber,
  });

export const getGravatarProfile = (hash: GravatarHash, memberNumber: number) =>
  gravatar(
    320,
    320
  )({
    url1x: getGravatarUrl(hash, 320),
    url2x: getGravatarUrl(hash, 640),
    url4x: getGravatarUrl(hash, 1280),
    memberNumber,
  });
