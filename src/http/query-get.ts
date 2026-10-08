import {renderBanners, systemBanners, toBanner} from '../templates/banners';
import * as TE from 'fp-ts/TaskEither';
import {Dependencies} from '../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Request, Response} from 'express';
import {getUserFromSession} from '../authentication';
import {StatusCodes} from 'http-status-codes';
import {oopsPage, pageTemplate} from '../templates';
import {Query, Params} from '../queries/query';
import {logInPath} from '../authentication/login/routes';
import {CompleteHtmlDocument, HttpResponse, sanitizeString} from '../types/html';
import {User} from '../types';
import {Member} from '../read-models/shared-state/return-types';
import {FailureWithStatus} from '../types/failure-with-status';
import * as O from 'fp-ts/Option';
import {match} from '../types/tagged-union';
import {ParsedQs} from 'qs';
import {navBarViewModel} from '../templates/navbar';

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

// Sends a query-style result as a full page for the logged-in |user| (who
// is |member| in the read model): the shared chrome around LoggedInContent,
// or the redirect / raw body / oops page the result asks for. Bespoke POST
// handlers that render a page (rather than redirect) use this too.
export const sendQueryResult =
  (deps: Dependencies) =>
  (req: Request, res: Response<CompleteHtmlDocument>, user: User, member: Member) =>
  (result: TE.TaskEither<FailureWithStatus, HttpResponse>) =>
    pipe(
      result,
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
          LoggedInContent: ({title, body, backLink}) =>
            res
              .status(200)
              .send(
                pageTemplate(
                  title,
                  user,
                  {
                    isSuperUser: member.isSuperUser,
                    isOwner: member.ownerOf.length > 0,
                  },
                  navBarViewModel(
                    deps.sharedReadModel.area.getAllMinimal(),
                    deps.sharedReadModel.equipment.getForAreaMinimal
                  ),
                  renderBanners(
                    [
                      ...systemBanners(member),
                      ...deps.sharedReadModel.notifications
                        .getForMember(member, new Date())
                        .map(toBanner),
                    ],
                    req.path
                  ),
                  backLink
                )(body)
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

export const queryGet =
  (deps: Dependencies, query: Query) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      deps.logger.info('Did not respond to query as user was not logged in.');
      res.redirect(logInPath);
      return;
    }
    const member = deps.sharedReadModel.members.getByMemberNumber(user.value.memberNumber);
    if (O.isNone(member)) {
      res.redirect(logInPath);
      return;
    }
    await sendQueryResult(deps)(req, res, user.value, member.value)(
      query(deps)(user.value, req.params, simplifyExpressQuery(req.query))
    );
  };
