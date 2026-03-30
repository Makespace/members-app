import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export const StoredEventDeletion = t.strict({
  eventId: tt.UUID,
  deletedAt: tt.DateFromISOString,
  deletedByMemberNumber: t.number,
  reason: tt.NonEmptyString,
});

export type StoredEventDeletion = t.TypeOf<typeof StoredEventDeletion>;
