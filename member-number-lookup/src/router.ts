import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from './shared-pages';
import {Dependencies} from './dependencies';
import asyncHandler from 'express-async-handler';
import {landing} from './routes/landing';
import {configureAuthRoutes} from './authentication';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';
import {commandHandler, createArea, declareSuperUser} from './commands';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const router = Router();

  router.get('/', asyncHandler(landing(deps)));

  router.get('/ping', (req, res) => res.status(StatusCodes.OK).send('pong\n'));

  router.post(
    '/api/declare-super-user',
    asyncHandler(commandHandler(deps, conf, declareSuperUser))
  );

  router.post(
    '/api/create-area',
    asyncHandler(commandHandler(deps, conf, createArea))
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
