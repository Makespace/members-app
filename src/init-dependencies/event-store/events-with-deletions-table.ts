import * as t from 'io-ts';

export const EventsWithDeletionsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      event_index: t.number,
      id: t.string,
      resource_id: t.string,
      resource_type: t.string,
      resource_version: t.number,
      event_type: t.string,
      payload: t.string,
      deleted_at: t.union([t.string, t.null]),
      deleted_by_member_number: t.union([t.number, t.null]),
      deletion_reason: t.union([t.string, t.null]),
    })
  ),
});

export type EventsWithDeletionsTable = t.TypeOf<typeof EventsWithDeletionsTable>;
