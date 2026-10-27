import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {isEquipmentTrainer} from '../authentication-helpers/is-equipment-trainer';
import {isCancelled, sessionContext} from './session-context';

export const MAX_REASON_LENGTH = 500;

const codec = t.intersection([
  t.strict({sessionId: tt.UUID}),
  t.partial({reason: t.string}),
]);

type CancelSession = {sessionId: tt.UUID; reason: string};

const decode = (input: unknown): t.Validation<CancelSession> =>
  pipe(
    codec.decode(input),
    E.map(({sessionId, reason}) => ({
      sessionId,
      reason: (reason ?? '').trim(),
    })),
    E.chain(command =>
      command.reason.length > MAX_REASON_LENGTH
        ? t.failure(
            input,
            [],
            `The reason must be at most ${MAX_REASON_LENGTH} characters`
          )
        : t.success(command)
    )
  );

// Calls a training off. Anybody booked is emailed, so it is final: there is
// no un-cancelling, and arranging it again is a duplicate away.
const process: Command<CancelSession>['process'] = input =>
  pipe(
    sessionContext(input.rm, input.command.sessionId),
    TE.fromEither,
    TE.chain(({session}) => {
      if (isCancelled(session)) {
        return TE.right(O.none);
      }
      if (new Date() >= session.endsAt) {
        return TE.left(
          failureWithStatus(
            'This training has already happened',
            StatusCodes.BAD_REQUEST
          )()
        );
      }
      return TE.right(
        O.some(
          constructEvent('TrainingSessionCancelled')({
            sessionId: session.id,
            reason: input.command.reason,
            actor: input.command.actor,
          })
        )
      );
    })
  );

// Any trainer on the machine, not only whoever arranged it: if they are ill,
// somebody else has to be able to call it off.
export const cancelSession: Command<CancelSession> = {
  process,
  decode,
  isAuthorized: ({actor, rm, input}) =>
    pipe(
      rm.trainingSessions.get(input.sessionId),
      O.exists(session =>
        isEquipmentTrainer({
          actor,
          rm,
          input: {equipmentId: session.equipmentId},
        })
      )
    ),
};
