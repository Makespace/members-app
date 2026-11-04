import {RequestHandler, Response} from 'express';
import expressAsyncHandler from 'express-async-handler';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../dependencies';
import {getUserFromSession} from '../authentication';
import {queryGet} from '../http/query-get';
import * as queries from '../queries';
import {constructViewModel} from '../queries/upcoming-trainings/construct-view-model';
import {render} from '../queries/upcoming-trainings/render';
import {oopsPage} from '../templates';
import {publicPage} from '../templates/public-page';
import {CompleteHtmlDocument, safe, sanitizeString} from '../types/html';
import {Route, get} from '../types/route';

// What trainings are coming up is open to anybody, so somebody thinking about
// joining, or a member who has not got a login link to hand, can see what is
// on. A logged-in member gets the page as it always was; anybody else gets
// the same list, with logging in standing in for signing up.
const trainingGet =
  (deps: Dependencies): RequestHandler =>
  async (req, res: Response<CompleteHtmlDocument>, next) => {
    if (O.isSome(getUserFromSession(deps)(req.session))) {
      return expressAsyncHandler(queryGet(deps, queries.upcomingTrainings))(
        req,
        res,
        next
      );
    }
    await pipe(
      constructViewModel(deps, O.none, new Date(), false),
      TE.match(
        failure => {
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        viewModel => {
          res.send(publicPage(safe('Get trained'), '/training')(render(viewModel)));
        }
      )
    )();
  };

export const publicTrainingRoutes = (deps: Dependencies): ReadonlyArray<Route> => [
  get('/training', expressAsyncHandler(trainingGet(deps))),
];
