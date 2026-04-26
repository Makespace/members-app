import * as t from 'io-ts';
import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../types/failure-with-status';
import {Dependencies} from '../dependencies';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Command} from '../commands';
import {Actor} from '../types/actor';
import {getUserFromSession} from '../authentication';
import {oopsPage} from '../templates';
import {applyToResource} from '../commands/apply-command-to-resource';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';

const getCommandFrom = <T>(body: unknown, command: Command<T>) =>
  pipe(
    body,
    // Stateless command validation rules go in decode.
    // Giving user feedback here is easy but must be stateless.
    // Direct quick feedback loop between the user -> code for validation.
    // No stateful buisness rules should be enforced here. See the notes on formPost for more details.
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

class PathType extends t.Type<string> {
  readonly _tag = 'PathType' as const;

  constructor() {
    super(
      'string',
      (m): m is string => typeof m === 'string' && m.startsWith('/'),
      (m, c) => (this.is(m) ? t.success(m) : t.failure(m, c)),
      t.identity
    );
  }
}
const path = new PathType();

const nextCodec = t.strict({next: path});

export const formPost =
  <T>(deps: Dependencies, command: Command<T>, successTarget: string) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    // Look at comments to see the core ideas of this pipe / how this works.
    await pipe(
      {
        actor: getActorFrom(req.session, deps),
        // First we use getCommandFrom to statelessly check the input is sensical and in a sense this can be thought of
        // as a fast path to minimise processing for garbage.
        input: getCommandFrom(req.body, command),
      },
      sequenceS(TE.ApplySeq),
      TE.filterOrElse(({actor, input}) => command.isAuthorized({actor, rm: deps.sharedReadModel, input}), () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.FORBIDDEN
        )()
      ),
      TE.chain(({input, actor}) =>
        applyToResource(deps, command)(input, actor)
      ),
      TE.match(
        failure => {
          deps.logger.error(failure, 'Failed to handle form submission');
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        () =>
          res.redirect(
            pipe(
              req.query,
              nextCodec.decode,
              E.map(q => q.next),
              E.getOrElse(() => successTarget)
            )
          )
      )
    )();
  };
