import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {DomainEvent} from '../types';
import * as O from 'fp-ts/Option';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../types/failureWithStatus';
import {Dependencies} from '../dependencies';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Command} from '../types/command';
import {Actor} from '../types/actor';
import {getUserFromSession} from '../authentication';
import {oopsPage} from '../shared-pages';

const getCommandFrom = <T>(body: unknown, command: Command<T>) =>
  pipe(
    body,
    command.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(
      failureWithStatus('Could not decode command', StatusCodes.BAD_REQUEST)
    ),
    TE.fromEither
  );

const persistOrNoOp =
  (deps: Dependencies) => (toPersist: O.Option<DomainEvent>) =>
    pipe(
      toPersist,
      O.matchW(
        () =>
          TE.right({
            status: StatusCodes.OK,
            message: 'No new events raised',
          }),
        deps.commitEvent
      )
    );

const getActorFrom = (session: unknown, deps: Dependencies) =>
  pipe(
    session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)()
    ),
    TE.map(user => ({tag: 'user', user}) satisfies Actor)
  );

export const formHandler =
  <T>(deps: Dependencies, command: Command<T>) =>
  async (req: Request, res: Response) => {
    await pipe(
      {
        actor: getActorFrom(req.session, deps),
        command: getCommandFrom(req.body, command),
        events: deps.getAllEvents(),
      },
      sequenceS(TE.ApplySeq),
      TE.filterOrElse(command.isAuthorized, () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.UNAUTHORIZED
        )()
      ),
      TE.map(command.process),
      TE.chainW(persistOrNoOp(deps)),
      TE.match(
        ({status, message}) => res.status(status).send(oopsPage(message)),
        () => res.redirect('back')
      )
    )();
  };
