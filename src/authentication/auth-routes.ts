import {Dependencies} from '../dependencies';
import {Config} from '../configuration';
import {Safe, safe} from '../types/html';
import {Route} from '../types/route';
import { routes as verifyEmailRoutes } from './verify-email/routes';
import { loginRoutes } from './login/routes';

export const logInPath: Safe = safe('/log-in');
const invalidLinkPath = '/auth/invalid-magic-link';
const invalidVerificationLinkPath = '/auth/invalid-email-verification-link';

export const authRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  return [
    ...loginRoutes(deps, conf),
    ...verifyEmailRoutes(deps, conf),
  ];
};
