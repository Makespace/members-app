import {createHash} from 'crypto';
import Handlebars from 'handlebars';

function getGravatarUrl(email: string, size: number = 160) {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = createHash('sha256').update(trimmedEmail).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

const AVATAR_THUMBNAIL_TEMPLATE = Handlebars.compile(
  `
    <img
      width="40"
      height="40"
      srcset="{{url1x}} 1x, {{url2x}} 2x, {{url4x}} 4x"
      src="{{url1x}}"
      alt="The avatar of {{memberNumber}}"
    />
  `
);

const AVATAR_PROFILE_TEMPLATE = Handlebars.compile(
  `
    <img
      width="320"
      height="320"
      srcset="{{url1x}} 1x, {{url2x}} 2x, {{url4x}} 4x"
      src="{{url1x}}"
      alt="The avatar of {{memberNumber}}"
    />
  `
);

export const registerAvatarHelpers = () => {
  Handlebars.registerHelper(
    'avatar_thumbnail',
    (email: string, memberNumber: number) => {
      return new Handlebars.SafeString(
        AVATAR_THUMBNAIL_TEMPLATE({
          url1x: getGravatarUrl(email, 40),
          url2x: getGravatarUrl(email, 80),
          url4x: getGravatarUrl(email, 160),
          memberNumber,
        })
      );
    }
  );
  Handlebars.registerHelper(
    'avatar_large',
    (email: string, memberNumber: number) => {
      return new Handlebars.SafeString(
        AVATAR_PROFILE_TEMPLATE({
          url1x: getGravatarUrl(email, 320),
          url2x: getGravatarUrl(email, 640),
          url4x: getGravatarUrl(email, 1280),
          memberNumber,
        })
      );
    }
  );
};
