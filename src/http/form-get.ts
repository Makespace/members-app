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

// See formPost for a more indepth discussion about the design decisions around why this is how it is.
// formGet is like formPost but rather than processing a command formGet handles calling a read model to
// get a view of the current state of a resource. This should be completely pure because its read-only and
// is where conflict resolution etc. is handled as described in form-post.
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
