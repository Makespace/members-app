import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export const EventsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      event_index: t.Int,
      id: t.string,
      event_type: t.string,
      payload: t.string,
      deleted_at_unix_ms: tt.withFallback(t.union([t.Int, t.null]), null),
      delete_reason: tt.withFallback(t.union([t.string, t.null]), null),
      mark_deleted_by_member_number: tt.withFallback(t.union([t.Int, t.null]), null),
    })
  ),
});
export type EventsTable = t.TypeOf<typeof EventsTable>;
