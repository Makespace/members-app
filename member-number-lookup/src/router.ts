import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from './shared-pages';
import {Dependencies} from './dependencies';
import asyncHandler from 'express-async-handler';
import {dashboard} from './routes/dashboard';
import {landing} from './routes/landing';
import {sendMemberNumberByEmail} from './routes/send-member-number-by-email';
import {configureAuthRoutes} from './authentication';
import {declareSuperUserCommandHandler} from './routes/api/declare-super-user';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const router = Router();

  router.get('/', landing);

  router.get('/dashboard', asyncHandler(dashboard(deps)));

  router.post('/send-member-number-by-email', sendMemberNumberByEmail);

  router.post(
    '/api/declare-super-user',
    asyncHandler(declareSuperUserCommandHandler(deps, conf))
  );

  configureAuthRoutes(router);

  router.use('/static', express.static(path.resolve(__dirname, './static')));

  router.use((req, res) => {
    res
      .status(StatusCodes.NOT_FOUND)
      .send(oopsPage('The page you have requested does not exist.'));
  });
  return router;
};
