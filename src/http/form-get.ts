import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {getUserFromSession} from '../authentication';
import {Dependencies} from '../dependencies';
import {oopsPage, pageTemplate} from '../templates';
import {Form} from '../types/form';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';
import {logInPath} from '../authentication/auth-routes';

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
    pipe(
      {
        user: user.value,
        readModel: deps.sharedReadModel,
      },
      form.constructForm({...req.query, ...req.params}),
      E.map(form.renderForm),
      E.map(({title, body}) =>
        pageTemplate(title, user.value, member.value.isSuperUser)(body)
      ),
      E.matchW(
        failure => {
          deps.logger.error(failure, 'Failed to show form to a user');
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        page => res.status(200).send(page)
      )
    );
  };
