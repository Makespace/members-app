import * as t from 'io-ts';

export const EventsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      event_index: t.Int,
      id: t.string,
      event_type: t.string,
      payload: t.string,
      deleted_at: t.union([t.string, t.null]),
    })
  ),
});
export type EventsTable = t.TypeOf<typeof EventsTable>;
