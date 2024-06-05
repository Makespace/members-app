import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from './templates';
import {Dependencies} from './dependencies';
import {configureAuthRoutes} from './authentication';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';
import {commands} from './commands';
import * as queries from './queries';
import {http} from './http';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import expressAsyncHandler from 'express-async-handler';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const query = http.queryGet(deps);
  const routes: ReadonlyArray<[string, ReturnType<typeof query>]> = [
    ['/', query(queries.landing)],
    ['/areas', query(queries.areas)],
    ['/areas/:area', query(queries.area)],
    ['/equipment', query(queries.allEquipment)],
    ['/equipment/:equipment', query(queries.equipment)],
    ['/super-users', query(queries.superUsers)],
    ['/event-log', query(queries.log)],
  ];

  const router = Router();

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

  router.get(
    '/areas/:area/add-equipment',
    http.formGet(deps, commands.equipment.add)
  );
  router.post(
    '/equipment/add',
    http.formPost(deps, commands.equipment.add, '/equipment')
  );

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

  pipe(
    routes,
    RA.map(([path, query]) => router.get(path, expressAsyncHandler(query)))
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
