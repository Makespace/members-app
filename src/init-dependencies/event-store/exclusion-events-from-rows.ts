import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import {EventExclusionsTable} from './events-table';
import {DomainEvent} from '../../types';
import {internalCodecFailure} from '../../types/failure-with-status';

const reshapeRowToExcludedEvent = (
  row: EventExclusionsTable['rows'][number]
) =>
  pipe(
    row.payload,
    tt.JsonFromString.decode,
    E.chain(tt.JsonRecord.decode),
    E.map(payload => ({
      type: row.event_type,
      ...payload,
    })),
    E.chain(DomainEvent.decode),
    E.map(payload => ({
      id: row.id,
      event_id: row.event_id,
      reverted_by_number: row.reverted_by_member_number,
      revert_reason: row.revert_reason,
      revert_at: new Date(row.reverted_at_timestamp_epoch_ms),
      payload,
    })),
    E.mapLeft(internalCodecFailure('Failed to get events from DB'))
  );

export const exclusionEventsFromRows = (rows: EventExclusionsTable['rows']) =>
  pipe(rows, E.traverseArray(reshapeRowToExcludedEvent));
