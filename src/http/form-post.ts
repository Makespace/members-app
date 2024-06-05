import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../types/failureWithStatus';
import {Dependencies} from '../dependencies';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Command} from '../commands';
import {Actor} from '../types/actor';
import {getUserFromSession} from '../authentication';
import {oopsPage} from '../templates';
import {persistOrNoOp} from '../commands/persist-or-no-op';

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

const getActorFrom = (session: unknown, deps: Dependencies) =>
  pipe(
    session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)()
    ),
    TE.map(user => ({tag: 'user', user}) satisfies Actor)
  );

export const formPost =
  <T>(deps: Dependencies, command: Command<T>, successTarget: string) =>
  async (req: Request, res: Response) => {
    await pipe(
      {
        actor: getActorFrom(req.session, deps),
        formPayload: getCommandFrom(req.body, command),
        events: deps.getAllEvents(),
      },
      sequenceS(TE.ApplySeq),
      TE.filterOrElse(command.isAuthorized, () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.UNAUTHORIZED
        )()
      ),
      TE.chain(({formPayload, actor}) =>
        pipe(
          {
            resource: TE.right(command.resource(formPayload)),
            resourceState: deps.getResourceEvents(
              command.resource(formPayload)
            ),
            formPayload: TE.right(formPayload),
            actor: TE.right(actor),
          },
          sequenceS(TE.ApplyPar)
        )
      ),
      TE.chainW(input =>
        persistOrNoOp(
          deps.commitEvent,
          input.resource,
          input.resourceState.version
        )(
          command.process({
            events: input.resourceState.events,
            command: {...input.formPayload, actor: input.actor},
          })
        )
      ),
      TE.mapLeft(failure => {
        deps.logger.warn(
          {...failure, url: req.originalUrl},
          'Could not handle form POST'
        );
        return failure;
      }),
      TE.match(
        ({status, message}) => res.status(status).send(oopsPage(message)),
        () => res.redirect(successTarget)
      )
    )();
  };
