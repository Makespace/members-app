import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import {SharedReadModel} from '../../read-models/shared-state';
import {failedEventsTable} from '../../read-models/shared-state/state';
import {User} from '../../types';
import {FailureWithStatus} from '../../types/failure-with-status';
import {Params} from '../query';
import {mustBeSuperuser} from '../util';
import {FailedEventLogSearch, ViewModel} from './view-model';

function parseQueryToSearch(query: Params): FailedEventLogSearch {
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
  (search: FailedEventLogSearch) => (failures: ViewModel['failures']) =>
    failures.slice(search.offset, search.offset + search.limit);

export const constructViewModel =
  (sharedReadModel: SharedReadModel) =>
  (user: User) =>
  (queryParams: Params): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(sharedReadModel, user),
      TE.map(() => {
        const allFailures = pipe(
          sharedReadModel.readOnlyDb.select().from(failedEventsTable).all(),
          RA.map(({error, payload}) => ({
            error,
            payload: payload,
          })),
          RA.reverse
        );
        const search = parseQueryToSearch(queryParams);
        return {
          count: allFailures.length,
          failures: applySearch(search)(allFailures),
          search,
          user,
        };
      })
    );
