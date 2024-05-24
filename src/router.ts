import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from './templates';
import {Dependencies} from './dependencies';
import {configureAuthRoutes} from './authentication';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';
import {commands} from './commands';
import {queries} from './queries';
import {http} from './http';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const router = Router();

  router.get('/', queries.landing(deps));

  router.get('/areas', queries.areas(deps));
  router.get('/areas/create', http.formGet(deps, commands.area.create));
  router.post(
    '/areas/create',
    http.formPost(deps, commands.area.create, '/areas')
  );
  router.get('/areas/add-owner', http.formGet(deps, commands.area.addOwner));
  router.post(
    '/areas/add-owner',
    http.formPost(deps, commands.area.addOwner, '/areas')
  );
  router.post(
    '/api/create-area',
    http.apiPost(deps, conf, commands.area.create)
  );

  router.get('/super-users', queries.superUsers(deps));
  router.get(
    '/super-users/declare',
    http.formGet(deps, commands.superUser.declare)
  );
  router.post(
    '/super-users/declare',
    http.formPost(deps, commands.superUser.declare, '/super-users')
  );
  router.post(
    '/api/declare-super-user',
    http.apiPost(deps, conf, commands.superUser.declare)
  );
  router.get(
    '/super-users/revoke',
    http.formGet(deps, commands.superUser.revoke)
  );
  router.post(
    '/super-users/revoke',
    http.formPost(deps, commands.superUser.revoke, '/super-users')
  );
  router.post(
    '/api/revoke-super-user',
    http.apiPost(deps, conf, commands.superUser.revoke)
  );

  router.post(
    '/api/link-number-to-email',
    http.apiPost(deps, conf, commands.memberNumbers.linkNumberToEmail)
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
