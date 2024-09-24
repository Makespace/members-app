/* eslint-disable unused-imports/no-unused-vars */
import {Client} from '@libsql/client/.';
import {getAllEvents} from '../../init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import * as TE from 'fp-ts/TaskEither';

export const asyncRefresh = (
  eventStoreDb: Client,
  updateState: (event: DomainEvent) => void
) => {
  let knownEvents = 0;
  return () => async () => {
    const events = await pipe(
      getAllEvents(eventStoreDb)(),
      TE.mapError(e => {
        console.log(e);
        return e;
      }),
      TE.getOrElse(() => {
        throw new Error('unexpected Left');
      })
    )();

    if (events.length > knownEvents) {
      events.slice(knownEvents - events.length).forEach(updateState);
      knownEvents = events.length;
    }
  };
};
