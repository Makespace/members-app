import {RequestHandler, Response} from 'express';
import expressAsyncHandler from 'express-async-handler';
import * as O from 'fp-ts/Option';
import {Dependencies} from '../../dependencies';
import {getUserFromSession} from '../../authentication';
import {queryGet} from '../../http/query-get';
import {publicPage} from '../../templates/public-page';
import {CompleteHtmlDocument, safe} from '../../types/html';
import {Route, get} from '../../types/route';
import {ownersGuide} from '.';
import {loggedOut} from './construct-view-model';
import {render} from './render';

// The owner's guide is open to anybody, so somebody thinking of becoming an
// owner can read it. A logged-in member gets it with their own areas; anybody
// else gets the same guide, with a prompt to log in wherever it would show
// them their areas.
const ownersGuideGet =
  (deps: Dependencies): RequestHandler =>
  (req, res: Response<CompleteHtmlDocument>, next) => {
    if (O.isSome(getUserFromSession(deps)(req.session))) {
      return expressAsyncHandler(queryGet(deps, ownersGuide))(req, res, next);
    }
    res.send(publicPage(safe("Owner's guide"), '/owners-guide')(render(loggedOut)));
  };

export const publicOwnersGuideRoutes = (
  deps: Dependencies
): ReadonlyArray<Route> => [get('/owners-guide', ownersGuideGet(deps))];
