import {Request, Response} from 'express';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from '../authentication';
import {Dependencies} from '../dependencies';
import {User} from '../types';
import {FailureWithStatus, failureWithStatus} from '../types/failureWithStatus';
import * as E from 'fp-ts/Either';
import {oopsPage} from '../templates';
import {sequenceS} from 'fp-ts/lib/Apply';

const getUser = (req: Request, deps: Dependencies) =>
  pipe(
    req.session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in.', StatusCodes.UNAUTHORIZED)()
    )
  );

type Form<T> = {
  renderForm: (viewModel: T) => string;
  constructForm: (
    input: unknown
  ) => (user: User) => E.Either<FailureWithStatus, T>;
};

export const formGet =
  <T>(deps: Dependencies, form: Form<T>) =>
  async (req: Request, res: Response) => {
    await pipe(
      {
        user: getUser(req, deps),
      },
      sequenceS(TE.ApplyPar),
      TE.chainEitherK(({user}) => form.constructForm(req.query)(user)),
      TE.map(form.renderForm),
      TE.mapLeft(failure => {
        deps.logger.warn(
          {...failure, url: req.originalUrl},
          'Could not render form for a user'
        );
        return failure;
      }),
      TE.matchW(
        failure => res.status(failure.status).send(oopsPage(failure.message)),
        page => res.status(200).send(page)
      )
    )();
  };
