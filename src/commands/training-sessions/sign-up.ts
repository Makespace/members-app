import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {signUpStatus} from '../../training-sessions/sign-ups';
import {isCancelled, sessionContext, sessionIdCodec} from './session-context';

type SignUp = t.TypeOf<typeof sessionIdCodec>;

const refusal = (message: string) =>
  TE.left(failureWithStatus(message, StatusCodes.BAD_REQUEST)());

// A member takes a place for themselves. Signing up twice is the same place.
// Not having passed the quiz does not stop anyone: members trained before the
// quiz existed come back for refreshers, so the confirmation page warns
// instead.
const process: Command<SignUp>['process'] = input =>
  pipe(
    sessionContext(input.rm, input.command.sessionId),
    TE.fromEither,
    TE.chain(({session}) => {
      if (input.command.actor.tag !== 'user') {
        return TE.right(O.none);
      }
      const memberNumber = input.command.actor.user.memberNumber;
      switch (
        signUpStatus(
          {...session, cancelled: isCancelled(session)},
          memberNumber,
          new Date()
        )
      ) {
        case 'booked':
          return TE.right(O.none);
        case 'open':
          return TE.right(
            O.some(
              constructEvent('TrainingSessionSignedUp')({
                sessionId: session.id,
                memberNumber,
                actor: input.command.actor,
              })
            )
          );
        case 'cancelled':
          return refusal('This training has been cancelled');
        case 'trainer':
          return refusal('You are the trainer for this training');
        case 'closed':
          return refusal('Sign-ups for this training have closed');
        case 'full':
          return refusal('This training is full');
      }
    })
  );

export const signUp: Command<SignUp> = {
  process,
  decode: sessionIdCodec.decode,
  isAuthorized: ({actor}) => actor.tag === 'user',
};
