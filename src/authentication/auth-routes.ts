import {Dependencies} from '../dependencies';
import {Config} from '../configuration';
import {html, Safe, safe} from '../types/html';
import {Route, get, post} from '../types/route';
import {
  auth,
  landing,
  callback,
  invalidLink,
  logIn,
  logOut,
  verifyEmailCallback,
} from './handlers';

export const logInPath: Safe = safe('/log-in');
const invalidLinkPath = '/auth/invalid-magic-link';
const invalidVerificationLinkPath = '/auth/invalid-email-verification-link';

export const authRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  return [
    get(logInPath, logIn(deps)),
    get('/log-out', logOut),
    post('/auth', auth),
    get('/auth', (_req, res) => res.redirect(logInPath)),
    get('/auth/landing', landing('/auth/callback')),
    get('/auth/callback', callback(invalidLinkPath)),
    get(invalidLinkPath, invalidLink(logInPath)),
    get('/auth/verify-email/landing', landing('/auth/verify-email/callback')),
    get(
      '/auth/verify-email/callback',
      verifyEmailCallback(deps, conf, invalidVerificationLinkPath)
    ),
    get(
      invalidVerificationLinkPath,
      invalidLink(
        logInPath,
        html`The verification link you have used is (no longer) valid. Go
          back to the <a href=${logInPath}>log in</a> page.`
      )
    ),
  ];
};
