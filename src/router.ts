import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from './shared-pages';
import {Dependencies} from './dependencies';
import asyncHandler from 'express-async-handler';
import * as pages from './pages';
import {configureAuthRoutes} from './authentication';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';
import {apiPost, commands, formGet, formPost} from './commands';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const router = Router();

  router.get('/', asyncHandler(pages.landing(deps)));

  router.get('/areas', asyncHandler(pages.areas(deps)));
  router.get(
    '/areas/create',
    asyncHandler(formGet(deps, commands.area.create))
  );
  router.post(
    '/areas/create',
    asyncHandler(formPost(deps, commands.area.create, '/areas'))
  );
  router.post(
    '/api/create-area',
    asyncHandler(apiPost(deps, conf, commands.area.create))
  );

  router.get('/super-users', asyncHandler(pages.superUsers(deps)));
  router.get(
    '/super-users/declare',
    asyncHandler(formGet(deps, commands.superUser.declare))
  );
  router.post(
    '/super-users/declare',
    asyncHandler(formPost(deps, commands.superUser.declare, '/super-users'))
  );
  router.post(
    '/api/declare-super-user',
    asyncHandler(apiPost(deps, conf, commands.superUser.declare))
  );
  router.get(
    '/super-users/revoke',
    asyncHandler(formGet(deps, commands.superUser.revoke))
  );
  router.post(
    '/super-users/revoke',
    asyncHandler(formPost(deps, commands.superUser.revoke, '/super-users'))
  );
  router.post(
    '/api/revoke-super-user',
    asyncHandler(apiPost(deps, conf, commands.superUser.revoke))
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
