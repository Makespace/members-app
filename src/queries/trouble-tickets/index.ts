import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {TroubleTicketStatus} from '../../types/trouble-ticket';
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
      status: pipe(
        O.fromNullable(queryParams.status),
        O.filter((value): value is string => typeof value === 'string'),
        O.chain(value =>
          pipe(
            TroubleTicketStatus.decode(value),
            O.fromEither
          )
        )
      ),
      only: pipe(
        O.fromNullable(queryParams.only),
        O.filter(
          (value): value is 'mine' | 'my-area' | 'my-machines' =>
            value === 'mine' || value === 'my-area' || value === 'my-machines'
        )
      ),
      page:
        typeof queryParams.page === 'string' && /^\d+$/.test(queryParams.page)
          ? Number(queryParams.page)
          : 1,
    }),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Trouble Tickets')))
  );
