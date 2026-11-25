import * as t from 'io-ts';

export const TicketPermission = t.keyof({
  everybody: null,
  'area-owner': null,
  manager: null,
});
export type TicketPermission = t.TypeOf<typeof TicketPermission>;
