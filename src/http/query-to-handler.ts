import expressAsyncHandler from 'express-async-handler';
import {Dependencies} from '../dependencies';
import * as queries from '../queries';
import {flow} from 'fp-ts/lib/function';
import {queryGet} from './query-get';

export const queryToHandler =
  (deps: Dependencies) => (path: string, query: queries.Query) => ({
    path,
    handler: flow(queryGet, expressAsyncHandler)(deps, query),
    method: 'get' as const,
  });
