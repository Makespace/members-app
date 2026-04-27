import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import {failedEventsTable} from '../../read-models/shared-state/state';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';
import {FailureWithStatus} from '../../types/failure-with-status';
import {Params} from '../query';
import {mustBeSuperuser} from '../util';
import {ViewModel} from './view-model';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User) =>
  (_queryParams: Params): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chain(() => deps.getDeletedEvents()),
      TE.map(deletedEvents => {
        const deletedEventIndexes = new Set(
          deletedEvents.map(event => event.event_index)
        );
        const allFailures = pipe(
          deps.sharedReadModel.readOnlyDb.select().from(failedEventsTable).all(),
          RA.filter(({eventIndex}) => !deletedEventIndexes.has(eventIndex)),
          RA.map(({error, eventId, eventIndex, eventType, payload}) => ({
            error,
            eventId,
            eventIndex,
            eventType,
            payload,
          })),
          RA.reverse
        );
        return {
          count: allFailures.length,
          failures: allFailures,
          user,
        };
      })
    );
