import {Params} from '../query';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {DeletedEventsSearch, ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';
import {mustBeSuperuser} from '../util';

function parseQueryToSearch(query: Params): DeletedEventsSearch {
  const rawOffset = query['offset'];
  const offsetAsNumber = Number(rawOffset);
  const offset = isNaN(offsetAsNumber) ? 0 : offsetAsNumber;

  const maxLimit = 100;
  const rawLimit = query['limit'];
  const limitAsNumber = Number(rawLimit);
  const limit = isNaN(limitAsNumber) ? maxLimit : limitAsNumber;

  return {
    offset: Math.max(0, offset),
    limit: Math.min(maxLimit, limit),
  };
}

const applySearch =
  (search: DeletedEventsSearch) =>
  (events: ViewModel['events']) => {
    const start = search.offset;
    const end = search.offset + search.limit;
    return events.slice(start, end);
  };

export const constructViewModel =
  (deps: Dependencies) => (user: User) => (queryParams: Params) =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chain(() => deps.getDeletedEvents()),
      TE.map(RA.reverse),
      TE.map(allEvents => {
        const count = allEvents.length;
        const search = parseQueryToSearch(queryParams);
        const events = applySearch(search)(allEvents);
        return {
          count,
          events,
          user,
          search,
        } satisfies ViewModel;
      })
    );
