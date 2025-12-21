import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Request, Response} from 'express';
import {getUserFromSession} from '../authentication';
import {StatusCodes} from 'http-status-codes';
import {oopsPage, pageTemplate} from '../templates';
import {Query, Params} from '../queries/query';
import {logInPath} from '../authentication/auth-routes';
import {CompleteHtmlDocument, sanitizeString} from '../types/html';
import * as O from 'fp-ts/Option';
import {match} from '../types/tagged-union';
import {ParsedQs} from 'qs';

// req.query has a complicated type:
// type ParsedQs = { [key: string]: undefined | string | string[] | ParsedQs | ParsedQs[] };
// Here we ignore the complex cases and filter down to Record<string, string>
// See https://evanhahn.com/gotchas-with-express-query-parsing-and-how-to-avoid-them/
const simplifyExpressQuery = (qs: ParsedQs) => {
  const params: Params = {};
  for (const [k, v] of Object.entries(qs)) {
    if (typeof v === 'string') {
      params[k] = v;
    }
  }
  return params;
};

export const queryGet =
  (deps: Dependencies, query: Query) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      deps.logger.info('Did not respond to query as user was not logged in.');
      res.redirect(logInPath);
      return;
    }
    const member = deps.sharedReadModel.members.get(user.value.memberNumber);
    if (O.isNone(member)) {
      res.redirect(logInPath);
      return;
    }
    await pipe(
      query(deps)(user.value, req.params, simplifyExpressQuery(req.query)),
      TE.matchW(
        failure => {
          deps.logger.error(failure, 'Failed respond to a query');
          return failure.status === StatusCodes.UNAUTHORIZED
            ? res.redirect(logInPath)
            : res
                .status(failure.status)
                .send(oopsPage(sanitizeString(failure.message)));
        },
        match({
          CompleteHtmlPage: ({rendered}) => res.status(200).send(rendered),
          LoggedInContent: ({title, body}) =>
            res
              .status(200)
              .send(
                pageTemplate(title, user.value, member.value.isSuperUser)(body)
              ),
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
