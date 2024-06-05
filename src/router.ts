import express, {RequestHandler, Router} from 'express';
import path from 'path';
import {oopsPage} from './templates';
import {Dependencies} from './dependencies';
import {configureAuthRoutes} from './authentication';
import {Config} from './configuration';
import {StatusCodes} from 'http-status-codes';
import {Command, commands} from './commands';
import * as queries from './queries';
import {http} from './http';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {Form} from './types/form';

export const createRouter = (deps: Dependencies, conf: Config): Router => {
  const query = (path: string, query: queries.Query) => ({
    path,
    handler: http.queryGet(deps, query),
    method: 'get' as const,
  });
  const command = <C, V>(
    noun: string,
    verb: string,
    cmd: Command<C> & Form<V>
  ) => [
    {
      path: `/${noun}/${verb}`,
      handler: http.formPost(deps, cmd, `/${noun}`),
      method: 'post' as const,
    },
    {
      path: `/${noun}/${verb}`,
      handler: http.formGet(deps, cmd),
      method: 'get' as const,
    },
    {
      path: `/api/${noun}/${verb}`,
      handler: http.apiPost(deps, conf, cmd),
      method: 'post' as const,
    },
  ];

  const routes: ReadonlyArray<{
    path: string;
    method: 'get' | 'post';
    handler: RequestHandler;
  }> = [
    query('/', queries.landing),
    query('/areas', queries.areas),
    ...command('areas', 'create', commands.area.create),
    ...command('areas', 'add-owner', commands.area.addOwner),
    query('/areas/:area', queries.area),
    query('/equipment', queries.allEquipment),
    query('/equipment/:equipment', queries.equipment),
    query('/super-users', queries.superUsers),
    ...command('super-users', 'declare', commands.superUser.declare),
    ...command('super-users', 'revoke', commands.superUser.revoke),
    query('/event-log', queries.log),
  ];

  const router = Router();

  router.get(
    '/areas/:area/add-equipment',
    http.formGet(deps, commands.equipment.add)
  );
  router.post(
    '/equipment/add',
    http.formPost(deps, commands.equipment.add, '/equipment')
  );

  router.post(
    '/api/link-number-to-email',
    http.apiPost(deps, conf, commands.memberNumbers.linkNumberToEmail)
  );

  pipe(
    routes,
    RA.map(({path, handler: middleware, method}) =>
      router[method](path, middleware)
    )
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
