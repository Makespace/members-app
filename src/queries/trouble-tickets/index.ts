import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';

export const troubleTickets: Query = deps => (user, _params, queryParams) =>
  pipe(
    user,
    constructViewModel(deps, {
      showAll: queryParams.show === 'all',
      page:
        typeof queryParams.page === 'string' && /^\d+$/.test(queryParams.page)
          ? Number(queryParams.page)
          : 1,
    }),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Trouble Tickets')))
  );
