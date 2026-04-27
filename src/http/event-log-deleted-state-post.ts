import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../types/failure-with-status';
import {Dependencies} from '../dependencies';
import {getUserFromSession} from '../authentication';
import {oopsPage} from '../templates';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';
import {mustBeSuperuser} from '../queries/util';

const bodyCodec = t.strict({
  eventIndex: tt.IntFromString,
});

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

const getBodyFrom = (body: unknown) =>
  pipe(
    body,
    bodyCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(
      failureWithStatus(
        'Could not decode deleted event form submission',
        StatusCodes.BAD_REQUEST
      )
    ),
    TE.fromEither
  );

const getNextPathFrom = (query: unknown, defaultPath: string) =>
  pipe(
    query,
    nextCodec.decode,
    E.map(args => args.next),
    E.getOrElse(() => defaultPath)
  );

export const eventLogDeletedStatePost =
  (deps: Dependencies, deleted: boolean, defaultPath: string) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    await pipe(
      getUserFromSession(deps)(req.session),
      TE.fromOption(() =>
        failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)()
      ),
      TE.chain(user =>
        pipe(
          mustBeSuperuser(deps.sharedReadModel, user),
          TE.map(() => user)
        )
      ),
      TE.chain(() => getBodyFrom(req.body)),
      TE.chain(({eventIndex}) =>
        deps.setEventDeletedState(eventIndex, deleted)
      ),
      TE.match(
        failure => {
          deps.logger.error(failure, 'Failed to update deleted state for event');
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        () => res.redirect(getNextPathFrom(req.query, defaultPath))
      )
    )();
  };
