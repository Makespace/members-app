import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {SharedReadModel} from '../../read-models/shared-state';
import {Equipment} from '../../read-models/shared-state/return-types';
import {TrainingSession} from '../../read-models/shared-state/training-sessions/get';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';

export const sessionIdCodec = t.strict({sessionId: tt.UUID});

type SessionContext = {
  session: TrainingSession;
  equipment: Equipment;
};

// A session and the machine it is on, which every sign-up page and command
// needs: the machine says who its trainers are and what to call it.
export const sessionContext = (
  rm: SharedReadModel,
  sessionId: tt.UUID
): E.Either<FailureWithStatus, SessionContext> =>
  pipe(
    rm.trainingSessions.get(sessionId),
    O.bindTo('session'),
    O.bind('equipment', ({session}) => rm.equipment.get(session.equipmentId)),
    E.fromOption(() =>
      failureWithStatus('No such training', StatusCodes.NOT_FOUND)()
    )
  );

// For a page reached with ?sessionId=...
export const sessionContextFromQuery = (
  rm: SharedReadModel,
  input: unknown
): E.Either<FailureWithStatus, SessionContext> =>
  pipe(
    input,
    sessionIdCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.chain(({sessionId}) => sessionContext(rm, sessionId))
  );

export const isCancelled = (session: TrainingSession) =>
  O.isSome(session.cancelled);
