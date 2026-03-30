import * as t from 'io-ts';

export const DeletedEventsTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      event_id: t.string,
      deleted_at: t.string,
      deleted_by_member_number: t.number,
      deletion_reason: t.string,
    })
  ),
});

export type DeletedEventsTable = t.TypeOf<typeof DeletedEventsTable>;
