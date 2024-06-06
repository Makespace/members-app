import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {Dependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Request, Response} from 'express';
import {getUserFromSession} from '../authentication';
import {failureWithStatus} from '../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {User} from '../types';
import {oopsPage, pageTemplate} from '../templates';
import {Params, Query} from '../queries/query';
import {logInPath} from '../authentication/auth-routes';

const buildPage =
  (deps: Dependencies, params: Params, query: Query) => (user: User) =>
    pipe(
      query(deps)(user, params),
      TE.map(({title, body}) => pageTemplate(title, O.some(user))(body))
    );

export const queryGet =
  (deps: Dependencies, query: Query) => async (req: Request, res: Response) => {
    await pipe(
      req.session,
      getUserFromSession(deps),
      TE.fromOption(() =>
        failureWithStatus('You are not logged in.', StatusCodes.UNAUTHORIZED)()
      ),
      TE.chain(buildPage(deps, req.params, query)),
      TE.matchW(
        failure => {
          deps.logger.error(failure, 'Failed respond to a query');
          failure.status === StatusCodes.UNAUTHORIZED
            ? res.redirect(logInPath)
            : res.status(failure.status).send(oopsPage(failure.message));
        },
        page => res.status(200).send(page)
      )
    )();
  };
