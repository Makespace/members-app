import {RequestHandler} from 'express';
import cookieSession from 'cookie-session';
import {Config} from '../configuration';
import {sessionOptions} from './session-config';

// cookie-session for every request except those that must not carry a
// session. cookieSessionPassportWorkaround gives each new session its
// regenerate/save shims, which counts as populating it, so cookie-session
// answers a visitor with no cookie by setting an empty one (`{}`). That is
// harmless for a person in a browser, but a display polling a public image
// never logs in and would be handed a fresh cookie on every poll - so those
// requests skip the session altogether and req.session stays undefined.
export const sessionMiddleware = (
  conf: Config,
  isSessionless: (path: string) => boolean
): RequestHandler => {
  const session = cookieSession(sessionOptions(conf));
  return (req, res, next) =>
    isSessionless(req.path) ? next() : session(req, res, next);
};
