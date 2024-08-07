/* eslint-disable unused-imports/no-unused-vars */
import {Client} from '@libsql/client/.';
import {getAllEvents} from '../../init-dependencies/event-store/get-all-events';
import {getRightOrFail} from '../../../tests/helpers';
import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {DomainEvent} from '../../types';

export const asyncRefresh = (
  eventStoreDb: Client,
  updateState: (event: DomainEvent) => void
) => {
  let knownEvents = 0;
  return () => async () => {
    const events = await pipe(
      getAllEvents(eventStoreDb)(),
      T.map(getRightOrFail)
    )();
    if (events.length > knownEvents) {
      events.slice(knownEvents - events.length).forEach(updateState);
      knownEvents = events.length;
    }
  };
};
