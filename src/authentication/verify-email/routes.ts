import {Dependencies} from '../../dependencies';
import {Config} from '../../configuration';
import {Route, get} from '../../types/route';
import {landing} from './landing-page';
import expressAsyncHandler from 'express-async-handler';

export const routes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  return [
    get('/auth/verify-email/landing', expressAsyncHandler(landing(deps, conf))),
  ];
};
