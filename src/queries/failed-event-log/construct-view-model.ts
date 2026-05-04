import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import {SharedReadModel} from '../../read-models/shared-state';
import {failedEventsTable} from '../../read-models/shared-state/state';
import {User} from '../../types';
import {FailureWithStatus} from '../../types/failure-with-status';
import {Params} from '../query';
import {mustBeSuperuser} from '../util';
import {ViewModel} from './view-model';
import { Int } from 'io-ts';

export const constructViewModel =
  (sharedReadModel: SharedReadModel) =>
  (user: User) =>
  (_queryParams: Params): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(sharedReadModel, user),
      TE.map(() => {
        const allFailures = pipe(
          sharedReadModel.readOnlyDb.select().from(failedEventsTable).all(),
          RA.map(({error, eventType, payload, eventIndex}) => ({
            error,
            eventType,
            payload: payload,
            eventIndex: eventIndex as Int,
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
