import {Params} from '../query';
import {pipe} from 'fp-ts/lib/function';
import {DomainEvent, User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel, LogSearch} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '../../read-models';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

function parseQueryToLogSearch(query: Params): LogSearch {
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

const applyLogSearch =
  (search: LogSearch) => (events: ReadonlyArray<DomainEvent>) =>
    pipe(events, events => {
      const start = search.offset;
      const end = search.offset + search.limit;
      return events.slice(start, end);
    });

export const constructViewModel =
  (deps: Dependencies) => (user: User) => (queryParams: Params) =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(readModels.superUsers.is(user.memberNumber), () =>
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.FORBIDDEN
        )()
      ),
      TE.map(RA.reverse),
      TE.map(allEvents => {
        const count = allEvents.length;
        const search = parseQueryToLogSearch(queryParams);
        const events = applyLogSearch(search)(allEvents);
        return {
          count,
          events,
          user,
          search,
        } satisfies ViewModel;
      })
    );
