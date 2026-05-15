import {Request, Response} from 'express';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {getUserFromSession} from '../authentication';
import {Dependencies} from '../dependencies';
import {oopsPage, pageTemplate} from '../templates';
import {Form} from '../types/form';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';
import {logInPath} from '../authentication/login/routes';
import { liftActorOrUser } from '../read-models/lift-actor-or-user';
import { FailureWithStatus, failureWithStatus } from '../types/failure-with-status';
import { StatusCodes } from 'http-status-codes';

// See formPost for a more indepth discussion about the design decisions around why this is how it is.
// formGet is like formPost but rather than processing a command formGet handles calling a read model to
// get a view of the current state of a resource. This should be completely pure because its read-only and
// is where conflict resolution etc. is handled as described in form-post.
export const formGet =
  <T>(deps: Dependencies, form: Form<T>) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      res.redirect(logInPath);
      return;
    }
    const member = deps.sharedReadModel.members.getByMemberNumber(user.value.memberNumber);
    if (O.isNone(member)) {
      res.redirect(logInPath);
      return;
    }
    const isAuthorized: TE.TaskEither<FailureWithStatus, null> = form.formIsAuthorized === null || form.formIsAuthorized({
      actor: liftActorOrUser(user.value),
      rm: deps.sharedReadModel
    }) ? TE.right(null) : TE.left(failureWithStatus(
      'You are not authorized to perform this action',
      StatusCodes.FORBIDDEN
    )());

    await pipe(
      isAuthorized,
      TE.chain(_ => form.constructForm({...req.query, ...req.params})({
        user: user.value,
        deps,
        readModel: deps.sharedReadModel,
      })),
      TE.map(form.renderForm),
      TE.map(({title, body}) =>
        pageTemplate(title, user.value, member.value.isSuperUser)(body)
      ),
      TE.matchW(
        failure => {
          deps.logger.error(failure, 'Failed to show form to a user');
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        page => res.status(200).send(page)
      )
    )();
  };
