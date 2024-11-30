import {Dependencies} from '../dependencies';
import {User, HttpResponse} from '../types';
import {FailureWithStatus} from '../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';

export type Params = Record<string, string>;

export type Query = (
  deps: Dependencies
) => (
  user: User,
  params: Params,
  queryParams: Params
) => TE.TaskEither<FailureWithStatus, HttpResponse>;
