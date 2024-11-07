import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Request, Response} from 'express';
import {getUserFromSession} from '../authentication';
import {StatusCodes} from 'http-status-codes';
import {User, HttpResponse} from '../types';
import {oopsPage, pageTemplate, templatePage} from '../templates';
import {Params, Query} from '../queries/query';
import {logInPath} from '../authentication/auth-routes';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';
import * as O from 'fp-ts/Option';

const buildPage =
  (deps: Dependencies, params: Params, query: Query) => (user: User) =>
    pipe(query(deps)(user, params), TE.map(templatePage));

export const queryGet =
  (deps: Dependencies, query: Query) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      deps.logger.info('Did not respond to query as user was not logged in.');
      res.redirect(logInPath);
      return;
    }
    await pipe(
      user.value,
      TE.right,
      TE.chain(buildPage(deps, req.params, query)),
      TE.matchW(
        failure => {
          deps.logger.error(failure, 'Failed respond to a query');
          failure.status === StatusCodes.UNAUTHORIZED
            ? res.redirect(logInPath)
            : res
                .status(failure.status)
                .send(oopsPage(sanitizeString(failure.message)));
        },
        HttpResponse.match({
          CompleteHtmlPage: ({rendered}) => res.status(200).send(rendered),
          LoggedInContent: ({title, body}) =>
            res.status(200).send(pageTemplate(title, user.value)(body)),
          Redirect: ({url}) => res.redirect(url),
          Raw: ({body, contentType}) => {
            res.status(200);
            res.setHeader('content-type', contentType);
            res.send(body as CompleteHtmlDocument);
            return res;
          },
        })
      )
    )();
  };
