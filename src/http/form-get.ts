import {Request, Response} from 'express';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from '../authentication';
import {Dependencies} from '../dependencies';
import {failureWithStatus} from '../types/failureWithStatus';
import {oopsPage} from '../templates';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Form} from '../types/form';

const getUser = (req: Request, deps: Dependencies) =>
  pipe(
    req.session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in.', StatusCodes.UNAUTHORIZED)()
    )
  );

export const formGet =
  <T>(deps: Dependencies, form: Form<T>) =>
  async (req: Request, res: Response) => {
    await pipe(
      {
        user: getUser(req, deps),
        events: deps.getAllEvents(),
      },
      sequenceS(TE.ApplyPar),
      TE.chainEitherK(form.constructForm({...req.query, ...req.params})),
      TE.map(form.renderForm),
      TE.matchW(
        failure => {
          deps.logger.error(failure, 'Failed to show form to a user');
          res.status(failure.status).send(oopsPage(failure.message));
        },
        page => res.status(200).send(page)
      )
    )();
  };
