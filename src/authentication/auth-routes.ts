import {Dependencies} from '../dependencies';
import {Config} from '../configuration';
import {Route} from '../types/route';
import { routes as verifyEmailRoutes } from './verify-email/routes';
import { loginRoutes } from './login/routes';

export const authRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  return [
    ...loginRoutes(deps),
    ...verifyEmailRoutes(deps, conf),
  ];
};
