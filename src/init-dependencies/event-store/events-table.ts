import * as t from 'io-ts';

export const EventsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      event_index: t.Int,
      id: t.string,
      event_type: t.string,
      payload: t.string,
    })
  ),
});
export type EventsTable = t.TypeOf<typeof EventsTable>;

export const DeletedEventsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      event_index: t.Int,
      id: t.string,
      event_type: t.string,
      payload: t.string,
      deleted_at: t.string,
      delete_reason: t.string,
      mark_deleted_by_member_number: t.Int,
    })
  ),
});
export type DeletedEventsTable = t.TypeOf<typeof DeletedEventsTable>;
