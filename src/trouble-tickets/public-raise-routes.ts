import {Request, RequestHandler, Response} from 'express';
import expressAsyncHandler from 'express-async-handler';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import {getUserFromSession} from '../authentication';
import {logInPath} from '../authentication/login/routes';
import {formGet} from '../http/form-get';
import {formPost} from '../http/form-post';
import {queryGet} from '../http/query-get';
import * as queries from '../queries';
import {focusFor} from '../queries/trouble-tickets-home/construct-view-model';
import {renderPublic as renderPublicHome} from '../queries/trouble-tickets-home/render';
import {applyCommand} from '../commands/apply-command';
import {commands} from '../commands';
import {
  raiseFormViewModel,
  renderRaiseForm,
} from '../commands/trouble-tickets/raise-form';
import {oopsPage} from '../templates';
import {isolatedPageTemplate} from '../templates/page-template';
import {
  CompleteHtmlDocument,
  html,
  Html,
  HtmlSubstitution,
  safe,
  sanitizeString,
} from '../types/html';
import {failureWithStatus} from '../types/failure-with-status';
import {Route, get, post} from '../types/route';
import {createFormToken, PublicReportGuard} from './public-report-guard';

// Reporting a problem is open to anybody: the QR codes on the machines point
// here, and the person standing at a broken machine has not necessarily got
// a login link to hand. A logged-in member gets the pages as they always
// were; anybody else gets the trouble tickets front door and the form, with
// the same questions plus who they are.

const reportedPath = '/trouble-tickets/reported';
const raisePath = '/trouble-tickets/raise';

// Fly puts the caller's address here, and overwrites whatever the caller
// sent; X-Forwarded-For (what req.ip reads) the caller can write themselves.
const clientIpOf = (req: Request): string =>
  req.get('Fly-Client-IP') ?? req.ip ?? 'unknown';

const isLoggedIn = (deps: Dependencies, req: Request) =>
  O.isSome(getUserFromSession(deps)(req.session));

// returnTo is where logging in from the header comes back to.
const publicPage =
  (title: HtmlSubstitution, returnTo?: string) => (body: Html) =>
    isolatedPageTemplate(title)(html`
    <header class="public-header">
      <strong>Makespace</strong>
      <a
        href="${safe(logInPath)}${returnTo === undefined
          ? safe('')
          : safe(`?next=${encodeURIComponent(returnTo)}`)}"
        >Log in</a
      >
    </header>
    <main class="public-page">${body}</main>
  `);

const homeGet =
  (deps: Dependencies): RequestHandler =>
  (req, res: Response<CompleteHtmlDocument>, next) => {
    if (isLoggedIn(deps, req)) {
      return expressAsyncHandler(
        queryGet(deps, queries.troubleTicketsHome)
      )(req, res, next);
    }
    const reference = (name: string) => {
      const value = req.query[name];
      return typeof value === 'string' ? value : undefined;
    };
    const focus = focusFor(deps.sharedReadModel, {
      equipmentId: reference('equipmentId'),
      areaId: reference('areaId'),
    });
    res
      .status(StatusCodes.OK)
      .send(
        publicPage(safe('Trouble tickets'), req.originalUrl)(
          renderPublicHome(focus)
        )
      );
  };

const raiseGet =
  (deps: Dependencies): RequestHandler =>
  (req, res: Response<CompleteHtmlDocument>, next) => {
    if (isLoggedIn(deps, req)) {
      return expressAsyncHandler(formGet(deps, commands.troubleTickets.raise))(
        req,
        res,
        next
      );
    }
    const page = renderRaiseForm(
      raiseFormViewModel(
        req.query,
        deps.sharedReadModel,
        O.some({formToken: createFormToken(deps.conf)})
      )
    );
    res
      .status(StatusCodes.OK)
      .send(publicPage(page.title, req.originalUrl)(page.body));
  };

const raisePost =
  (deps: Dependencies, guard: PublicReportGuard): RequestHandler =>
  (req, res: Response<CompleteHtmlDocument>, next) => {
    if (isLoggedIn(deps, req)) {
      return expressAsyncHandler(
        formPost(deps, commands.troubleTickets.raise, '/trouble-tickets')
      )(req, res, next);
    }
    const verdict = guard(req.body, clientIpOf(req));
    switch (verdict.tag) {
      case 'drop':
        deps.logger.info(
          {reason: verdict.reason},
          'Dropped a trouble ticket report from somebody not logged in'
        );
        return res.redirect(reportedPath);
      case 'refuse':
        deps.logger.info(
          {reason: verdict.reason},
          'Refused a trouble ticket report from somebody not logged in'
        );
        return res
          .status(verdict.status)
          .send(oopsPage(sanitizeString(verdict.message)));
      case 'accept':
        break;
    }
    const raisePublic = commands.troubleTickets.raisePublic;
    return expressAsyncHandler(async () => {
      await pipe(
        raisePublic.decode(req.body),
        E.mapLeft(errors =>
          failureWithStatus(
            `Please check your report: ${formatValidationErrors(errors).join(
              '; '
            )}`,
            StatusCodes.BAD_REQUEST
          )()
        ),
        TE.fromEither,
        TE.chain(input =>
          applyCommand(deps, raisePublic)(input, {tag: 'public'})
        ),
        TE.match(
          failure => {
            deps.logger.error(
              failure,
              'Failed to raise a trouble ticket for somebody not logged in'
            );
            res
              .status(failure.status)
              .send(oopsPage(sanitizeString(failure.message)));
          },
          () => res.redirect(reportedPath)
        )
      )();
    })(req, res, next);
  };

// Says nothing about who we matched them to: anybody can type anybody's
// address, so what we know about it goes only to that inbox.
const reportedPage = publicPage(safe('Thanks for your report'))(html`
  <div class="stack">
    <h1>Thanks for letting us know</h1>
    <p>
      The owners of the equipment have your report and will pick it up from
      here.
    </p>
    <p>
      If you gave an email address, a confirmation is on its way. It has a
      link to add this report to your Makespace account, so you can follow
      it.
    </p>
    <p>
      If the equipment is not useable, or is unsafe, please put a sign on it
      telling other members, and consider a post on the Google group.
    </p>
    <p><a href="/trouble-tickets">Report another problem</a></p>
  </div>
`);

export const publicRaiseRoutes = (
  deps: Dependencies,
  guard: PublicReportGuard
): ReadonlyArray<Route> => [
  get('/trouble-tickets', homeGet(deps)),
  get(raisePath, raiseGet(deps)),
  post(raisePath, raisePost(deps, guard)),
  get(reportedPath, (req, res: Response<CompleteHtmlDocument>) =>
    isLoggedIn(deps, req)
      ? res.redirect('/trouble-tickets')
      : res.status(StatusCodes.OK).send(reportedPage)
  ),
];
