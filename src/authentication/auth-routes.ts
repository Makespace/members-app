import {Dependencies} from '../dependencies';
import {Safe, safe} from '../types/html';
import {Route, get, post} from '../types/route';
import {auth, landing, callback, invalidLink, logIn, logOut} from './handlers';

export const logInPath: Safe = safe('/log-in');
const invalidLinkPath = '/auth/invalid-magic-link';

export const authRoutes = (deps: Dependencies): ReadonlyArray<Route> => {
  return [
    get(logInPath, logIn(deps)),
    get('/log-out', logOut),
    post('/auth', auth),
    get('/auth', (_req, res) => res.redirect(logInPath)),
    get('/auth/landing', landing),
    get('/auth/callback', callback(invalidLinkPath)),
    get(invalidLinkPath, invalidLink(logInPath)),
  ];
};
