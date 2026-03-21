import expressAsyncHandler from 'express-async-handler';
import {Dependencies} from '../dependencies';
import * as queries from '../queries';
import {flow} from 'fp-ts/lib/function';
import {queryGet} from './query-get';
import { Route } from '../types/route';

export const queryToHandler =
  (deps: Dependencies) => (path: string, query: queries.Query): Route => ({
    path,
    handler: flow(queryGet, expressAsyncHandler)(deps, query),
    method: 'get' as const,
  });
