import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import {StatusCodes} from 'http-status-codes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Client} from '@libsql/client';
import { insertEventWithOptimisticConcurrencyControl } from './insert-event-with-optimistic-concurrency-control';

export const commitEvent =
  (
    eventDB: Client,
    logger: Logger,
    refreshReadModel: Dependencies['sharedReadModel']['asyncRefresh']
  ): Dependencies['commitEvent'] =>
  (
    lastSeenEventIndex
  ) =>
  (
    event
  ): TE.TaskEither<FailureWithStatus, {status: number; message: string}> => {
    return pipe(
      insertEventWithOptimisticConcurrencyControl(
        event,
        lastSeenEventIndex,
        eventDB,
      ),
      TE.chainEitherK(result => {
        switch (result) {
          case 'raised-event':
            logger.info(event, 'Event committed');
            return E.right({
              message: 'Raised event',
              status: StatusCodes.CREATED,
            });
          case 'last-known-version-out-of-date':
            return E.left(
              failureWithStatus(
                'Resource has changes since the event to be committed was computed',
                StatusCodes.BAD_REQUEST
              )()
            );
        }
      }),
      TE.tapTask(() => refreshReadModel())
    );
  };
