import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import {EventExclusionsTable} from './events-table';
import * as t from 'io-ts';
import {DomainEvent} from '../../types';
import {internalCodecFailure} from '../../types/failure-with-status';
import { ExcludedEvent } from './excluded-event';

const reshapeRowToEvent = (row: EventExclusionsTable['rows'][number]) =>
  pipe(
    row.payload,
    tt.JsonFromString.decode,
    E.chain(tt.JsonRecord.decode),
    E.map(payload => ({
      type: row.event_type,
      ...payload,
    }))
  );

export const exclusionEventsFromRows = (rows: EventExclusionsTable['rows']): ReadonlyArray<ExcludedEvent> =>
  pipe(
    rows,
    E.traverseArray(reshapeRowToEvent),
    E.chain(t.readonlyArray(DomainEvent).decode),
    E.mapLeft(internalCodecFailure('Failed to get events from DB'))
  );
