import {Route, get, post} from '../types/route';
import {auth, callback, invalidLink, logIn, logOut} from './handlers';

export const logInPath = '/log-in';
const invalidLinkPath = '/auth/invalid-magic-link';

export const authRoutes: ReadonlyArray<Route> = [
  get(logInPath, logIn),
  get('/log-out', logOut),
  post('/auth', auth),
  get('/auth/callback', callback(invalidLinkPath)),
  get(invalidLinkPath, invalidLink(logInPath)),
];
