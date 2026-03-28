import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import {EventsTable} from './events-table';
import * as t from 'io-ts';
import {StoredDomainEvent} from '../../types';
import {internalCodecFailure} from '../../types/failure-with-status';

const reshapeRowToEvent = (row: EventsTable['rows'][number]) =>
  pipe(
    row.payload,
    tt.JsonFromString.decode,
    E.chain(tt.JsonRecord.decode),
    E.map(payload => ({
      event_index: row.event_index,
      event_id: row.id,
      type: row.event_type,
      ...payload,
    }))
  );

export const eventsFromRows = (rows: EventsTable['rows']) =>
  pipe(
    rows,
    E.traverseArray(reshapeRowToEvent),
    E.chain(t.readonlyArray(StoredDomainEvent).decode),
    E.mapLeft(internalCodecFailure('Failed to get events from DB'))
  );
