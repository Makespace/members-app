import * as t from 'io-ts';

export const EventsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      id: t.string,
      resource_id: t.string,
      resource_type: t.string,
      resource_version: t.number,
      event_type: t.string,
      payload: t.string,
    })
  ),
});
export type EventsTable = t.TypeOf<typeof EventsTable>;

export const EventExclusionsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      id: t.string,
      event_id: t.string,
      reverted_by_number: t.Int,
      revert_reason: t.string,
    })
  ),
});
export type EventExclusionsTable = t.TypeOf<typeof EventExclusionsTable>;
