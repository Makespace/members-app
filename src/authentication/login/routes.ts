import {Dependencies} from '../../dependencies';
import {Config} from '../../configuration';
import {Safe, safe} from '../../types/html';
import {Route, get, post} from '../../types/route';
import {auth, landing as authLinkLanding, callback, logIn, logOut} from './handlers';
import { invalidLink } from './invalid-link';

export const logInPath: Safe = safe('/log-in');
const invalidLinkPath = '/auth/invalid-magic-link';

export const loginRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  return [
    get(logInPath, logIn(deps)),
    get('/log-out', logOut),
    post('/auth', auth),
    get('/auth', (_req, res) => res.redirect(logInPath)),
    get('/auth/landing', authLinkLanding),
    get('/auth/callback', callback(invalidLinkPath)),
    get(invalidLinkPath, invalidLink(logInPath)),
  ];
};
