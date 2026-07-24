import * as t from 'io-ts';
import * as tt from 'io-ts-types';

// The parsed free-text answers of a trouble ticket submission. Shared by the ingest
// path, the event payload and the read model. Missing answers are defaulted to ''.
export const TroubleTicketResponse = t.strict({
  otherEquipmentDetail: t.string,
  status: t.string,
  attempting: t.string,
  issue: t.string,
  steps: t.string,
});
export type TroubleTicketResponse = t.TypeOf<typeof TroubleTicketResponse>;

export const TroubleTicketStatus = t.keyof({
  Todo: null,
  'In Progress': null,
  Resolved: null,
  Parked: null,
  'Needs Help': null,
});
export type TroubleTicketStatus = t.TypeOf<typeof TroubleTicketStatus>;

// The read-model view of a trouble ticket (what queries return). In Step 1 `status` is
// always 'Todo'; the full enum is defined now so later steps need no type change here.
// `equipmentId` is null when the raw `submittedEquipment` string could not be resolved to
// a known equipment record - such tickets live in the "Unassigned" bucket.
export const TroubleTicket = t.strict({
  id: tt.UUID,
  status: TroubleTicketStatus,
  submittedAt: tt.DateFromISOString,
  submittedName: t.union([t.string, t.null]),
  submittedMemberNumber: t.union([t.number, t.null]),
  submittedEmail: t.union([t.string, t.null]),
  submittedEquipment: t.union([t.string, t.null]),
  equipmentId: t.union([tt.UUID, t.null]),
  response: TroubleTicketResponse,
});
export type TroubleTicket = t.TypeOf<typeof TroubleTicket>;
