import {Dependencies} from '../dependencies';
import {User, HttpResponse} from '../types';
import {FailureWithStatus} from '../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';

export type Params = Record<string, string>;

export type Query = (
  deps: Dependencies
) => (
  user: User,
  params: Params
) => TE.TaskEither<FailureWithStatus, HttpResponse>;
