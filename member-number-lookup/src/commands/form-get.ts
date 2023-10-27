import {Request, Response} from 'express';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from '../authentication';
import {logInRoute} from '../authentication/configure-auth-routes';
import {Dependencies} from '../dependencies';
import {User} from '../types';
import {FailureWithStatus, failureWithStatus} from '../types/failureWithStatus';
import * as E from 'fp-ts/Either';

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
      req.session,
      getUserFromSession(deps),
      TE.fromOption(() =>
        failureWithStatus('You are not logged in.', StatusCodes.UNAUTHORIZED)()
      ),
      TE.chainEitherK(form.constructForm({})),
      TE.map(form.renderForm),
      TE.matchW(
        () => res.redirect(logInRoute),
        page => res.status(200).send(page)
      )
    )();
  };
