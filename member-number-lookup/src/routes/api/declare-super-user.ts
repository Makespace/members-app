/* eslint-disable @typescript-eslint/no-unused-vars */
import {Request, Response} from 'express';
import {Config} from '../../configuration';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {DomainEvent} from '../../types';
import * as O from 'fp-ts/Option';

const DeclareSuperUserCommand = t.strict({
  memberNumber: tt.NumberFromString,
});

type DeclareSuperUserCommand = t.TypeOf<typeof DeclareSuperUserCommand>;

const declareSuperUser =
  (command: DeclareSuperUserCommand) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<DomainEvent> =>
    O.none;

const commitEvents = (
  event: DomainEvent
): TE.TaskEither<
  {msg: 'Failed to persist event'; status: 500; errors: unknown},
  {status: 201; msg: 'Persisted a new event'}
> => TE.left({msg: 'Failed to persist event', status: 500, errors: {}});

export const declareSuperUserCommandHandler =
  (conf: Config) => async (req: Request, res: Response) => {
    if (req.headers.authorization !== `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`) {
      res.status(401).send('Unauthorized\n');
    } else {
      await pipe(
        req.body,
        DeclareSuperUserCommand.decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(validationErrors => ({
          msg: 'Failed to decode command',
          errors: validationErrors,
          status: 400,
        })),
        TE.fromEither,
        TE.chainW(command =>
          pipe(
            [],
            declareSuperUser(command),
            O.matchW(
              () => TE.right({status: 200, msg: 'No new events raised'}),
              event => commitEvents(event)
            )
          )
        ),
        TE.match(
          left =>
            res
              .status(left.status)
              .send({message: left.msg, errors: left.errors}),
          right => res.status(right.status).send({message: right.msg})
        )
      )();
    }
  };
