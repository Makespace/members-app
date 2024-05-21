import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failureWithStatus';
import {InStatement} from '@libsql/client/.';

export type QueryEventsDatabase = (
  statements: InStatement[]
) => TE.TaskEither<FailureWithStatus, unknown>;
