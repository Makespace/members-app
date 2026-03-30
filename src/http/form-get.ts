import {Request, Response} from 'express';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {getUserFromSession} from '../authentication';
import {Dependencies} from '../dependencies';
import {oopsPage, pageTemplate} from '../templates';
import {Form, FormResult} from '../types/form';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';
import {logInPath} from '../authentication/login/routes';
import {FailureWithStatus} from '../types/failure-with-status';

const toTaskEither = <T>(
  result: FormResult<T>
): TE.TaskEither<FailureWithStatus, T> =>
  typeof result === 'function' ? result : TE.fromEither(result);

// See formPost for a more indepth discussion about the design decisions around why this is how it is.
// formGet is like formPost but rather than processing a command formGet handles calling a read model to
// get a view of the current state of a resource. This should be completely pure because its read-only and
// is where conflict resolution etc. is handled as described in form-post.
export const formGet =
  <T>(deps: Dependencies, form: Form<T>) =>
  (req: Request, res: Response<CompleteHtmlDocument>) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      res.redirect(logInPath);
      return;
    }
    const member = deps.sharedReadModel.members.get(user.value.memberNumber);
    if (O.isNone(member)) {
      res.redirect(logInPath);
      return;
    }
    const context = {
      user: user.value,
      readModel: deps.sharedReadModel,
      deps,
    };
    void pipe(
      toTaskEither(form.constructForm({...req.query, ...req.params})(context)),
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
