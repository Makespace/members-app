import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {safe, toLoggedInContent} from '../../types/html';
import {Query} from '../query';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

// Where the navbar's "Get trained" goes: every training coming up, on every
// machine, so a member can find one without knowing which machine to look on.
// Anybody not logged in gets the same list from public-training-routes.
export const upcomingTrainings: Query = deps => (user, _params, queryParams) =>
  pipe(
    constructViewModel(
      deps,
      O.some(user),
      new Date(),
      queryParams.show === 'trained'
    ),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Get trained')))
  );
