import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {canCancelPlace} from '../../training-sessions/sign-ups';
import {isCancelled, sessionContext, sessionIdCodec} from './session-context';

type CancelPlace = t.TypeOf<typeof sessionIdCodec>;

// A member gives up their own place. Not having one is nothing to record.
const process: Command<CancelPlace>['process'] = input =>
  pipe(
    sessionContext(input.rm, input.command.sessionId),
    TE.fromEither,
    TE.chain(({session}) => {
      if (
        input.command.actor.tag !== 'user' ||
        !session.attendees.includes(input.command.actor.user.memberNumber)
      ) {
        return TE.right(O.none);
      }
      if (
        !canCancelPlace(
          {...session, cancelled: isCancelled(session)},
          new Date()
        )
      ) {
        return TE.left(
          failureWithStatus(
            'This training has already started or been cancelled',
            StatusCodes.BAD_REQUEST
          )()
        );
      }
      return TE.right(
        O.some(
          constructEvent('TrainingSessionSignUpCancelled')({
            sessionId: session.id,
            memberNumber: input.command.actor.user.memberNumber,
            actor: input.command.actor,
          })
        )
      );
    })
  );

export const cancelPlace: Command<CancelPlace> = {
  process,
  decode: sessionIdCodec.decode,
  isAuthorized: ({actor}) => actor.tag === 'user',
};
