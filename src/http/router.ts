import express, {Router} from 'express';
import path from 'path';
import {oopsPage} from '../templates';
import {StatusCodes} from 'http-status-codes';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {Route} from '../types/route';
import {html} from '../types/html';
import {setupExpressErrorHandler} from '@sentry/node';

export const createRouter = (routes: ReadonlyArray<Route>): Router => {
  const router = Router();

  pipe(
    routes,
    RA.map(({path, handler: middleware, method}) =>
      router[method](path, middleware)
    )
  );

  router.use('/static', express.static(path.resolve(__dirname, '../static')));
  setupExpressErrorHandler(router);

  router.use((req, res) => {
    res
      .status(StatusCodes.NOT_FOUND)
      .send(oopsPage(html`The page you have requested does not exist.`));
  });
  return router;
};
