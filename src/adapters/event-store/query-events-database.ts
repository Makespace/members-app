import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failureWithStatus';
import {InArgs} from '@libsql/client/.';

export type QueryEventsDatabase = (
  query: string,
  args: InArgs
) => TE.TaskEither<FailureWithStatus, unknown>;
