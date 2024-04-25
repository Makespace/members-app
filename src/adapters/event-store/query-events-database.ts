import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failureWithStatus';

export type QueryEventsDatabase = (
  query: string,
  values?: unknown
) => TE.TaskEither<FailureWithStatus, unknown>;
