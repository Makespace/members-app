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
