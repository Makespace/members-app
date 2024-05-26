import {Request, Response} from 'express';
import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../../dependencies';
import {getUserFromSession} from '../../authentication';
import {logInRoute} from '../../authentication/configure-auth-routes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {constructViewModel} from './construct-view-model';
import {Params} from './construct-view-model';
import {render} from './render';
import * as E from 'fp-ts/Either';
import {sequenceS} from 'fp-ts/lib/Apply';
import {formatValidationErrors} from 'io-ts-reporters';

const notLoggedIn = () =>
  failureWithStatus('You are not logged in.', StatusCodes.UNAUTHORIZED)();

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

const getParams =
  (deps: Dependencies) =>
  (req: Request): E.Either<FailureWithStatus, Params> =>
    pipe(
      {
        user: pipe(
          req.session,
          getUserFromSession(deps),
          E.fromOption(notLoggedIn)
        ),
        areaId: pipe(
          req.params,
          t.strict({area: t.string}).decode,
          E.mapLeft(invalidParams),
          E.map(params => params.area)
        ),
      },
      sequenceS(E.Apply)
    );

export const area =
  (deps: Dependencies) => async (req: Request, res: Response) => {
    await pipe(
      req,
      getParams(deps),
      TE.fromEither,
      TE.chain(constructViewModel(deps)),
      TE.map(render),
      TE.matchW(
        () => res.redirect(logInRoute),
        page => res.status(200).send(page)
      )
    )();
  };
