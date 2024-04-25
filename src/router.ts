import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from './shared-pages';
import {Dependencies} from './dependencies';
import asyncHandler from 'express-async-handler';
import {landing} from './routes/landing';
import {configureAuthRoutes} from './authentication';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';
import {commandHandler, createArea, formGet, formPost} from './commands';
import {areas} from './routes/areas';
import {superUsers} from './routes/super-users';
import {superUser} from './commands/super-user';
import {area} from './commands/area';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const router = Router();

  router.get('/', asyncHandler(landing(deps)));

  router.get('/areas', asyncHandler(areas(deps)));
  router.get('/areas/create', asyncHandler(formGet(deps, area.create)));
  router.post(
    '/areas/create',
    asyncHandler(formPost(deps, createArea, '/areas'))
  );
  router.post(
    '/api/create-area',
    asyncHandler(commandHandler(deps, conf, area.create))
  );

  router.get('/super-users', asyncHandler(superUsers(deps)));
  router.get(
    '/super-users/declare',
    asyncHandler(formGet(deps, superUser.declare))
  );
  router.post(
    '/super-users/declare',
    asyncHandler(formPost(deps, superUser.declare, '/super-users'))
  );
  router.post(
    '/api/declare-super-user',
    asyncHandler(commandHandler(deps, conf, superUser.declare))
  );
  router.get(
    '/super-users/revoke',
    asyncHandler(formGet(deps, superUser.revoke))
  );
  router.post(
    '/super-users/revoke',
    asyncHandler(formPost(deps, superUser.revoke, '/super-users'))
  );
  router.post(
    '/api/revoke-super-user',
    asyncHandler(commandHandler(deps, conf, superUser.revoke))
  );

  configureAuthRoutes(router);

  router.get('/ping', (req, res) => res.status(StatusCodes.OK).send('pong\n'));

  router.use('/static', express.static(path.resolve(__dirname, './static')));

  router.use((req, res) => {
    res
      .status(StatusCodes.NOT_FOUND)
      .send(oopsPage('The page you have requested does not exist.'));
  });
  return router;
};