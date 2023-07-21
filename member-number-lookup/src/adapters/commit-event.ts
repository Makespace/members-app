import {StatusCodes} from 'http-status-codes';
import {FailureWithStatus, failureWithStatus} from '../types/failureWithStatus';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../dependencies';

export const commitEvent: Dependencies['commitEvent'] = (): TE.TaskEither<
  FailureWithStatus,
  {status: StatusCodes.CREATED; message: 'Persisted a new event'}
> =>
  TE.left(
    failureWithStatus(
      'commitEvent not implemented',
      StatusCodes.NOT_IMPLEMENTED
    )()
  );
