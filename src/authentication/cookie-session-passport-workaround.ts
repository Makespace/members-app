import {RequestHandler} from 'express';

// see https://github.com/jaredhanson/passport/issues/904#issuecomment-1307558283
export const cookieSessionPassportWorkaround: RequestHandler = (
  request,
  response,
  next
) => {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb: () => void) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb: () => void) => {
      cb();
    };
  }
  next();
};
