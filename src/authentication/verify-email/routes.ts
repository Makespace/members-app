import {Dependencies} from '../../dependencies';
import {Config} from '../../configuration';
import {Safe, safe} from '../../types/html';
import {Route, get} from '../../types/route';
import {landing } from './landing-page';
import { invalidLink } from './invalid-link';

export const logInPath: Safe = safe('/log-in');
const invalidVerificationLinkPath = '/auth/invalid-email-verification-link';

export const routes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  return [
    get('/auth/verify-email/landing', landing(deps, conf)),
    get(invalidVerificationLinkPath, invalidLink),
  ];
};
