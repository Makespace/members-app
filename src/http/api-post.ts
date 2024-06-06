import {Request, Response} from 'express';
import {Config} from '../configuration';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../types/failureWithStatus';
import {Dependencies} from '../dependencies';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Command} from '../commands';
import {Actor} from '../types/actor';
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

const getActorFrom = (authorization: unknown, conf: Config) =>
  pipe(
    authorization,
    t.string.decode,
    E.mapLeft(
      failureWithStatus(
        'Missing authorization header',
        StatusCodes.UNAUTHORIZED
      )
    ),
    E.chain(authString =>
      authString === `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`
        ? E.right({tag: 'token', token: 'admin'} satisfies Actor)
        : E.left(
            failureWithStatus('Bad Bearer Token', StatusCodes.UNAUTHORIZED)()
          )
    ),
    TE.fromEither
  );

// See formPost for a more indepth discussion about the design decisions around why this is how it is.
export const apiPost =
  <T>(deps: Dependencies, conf: Config, command: Command<T>) =>
  async (req: Request, res: Response) => {
    await pipe(
      {
        actor: getActorFrom(req.headers.authorization, conf),
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
      TE.match(
        failure => {
          deps.logger.error(failure, 'API call failed');
          res.status(failure.status).send(failure);
        },
        ({status, message}) => res.status(status).send({message})
      )
    )();
  };
