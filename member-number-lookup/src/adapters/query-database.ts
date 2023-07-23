import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../types/failureWithStatus';

export type QueryDatabase = (
  query: string,
  values?: unknown
) => TE.TaskEither<FailureWithStatus, unknown>;
