import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {TicketPermission} from './trouble-ticket-permission';

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
  // Editable title; defaults to the form's "issue" text at creation.
  title: t.string,
  permission: TicketPermission,
  submittedAt: tt.DateFromISOString,
  submittedName: t.union([t.string, t.null]),
  submittedMemberNumber: t.union([t.number, t.null]),
  // The number somebody typed on the public form, when the ticket could not
  // be put on that member's account. Unverified.
  providedMemberNumber: t.union([t.number, t.null]),
  submittedEmail: t.union([t.string, t.null]),
  submittedEquipment: t.union([t.string, t.null]),
  equipmentId: t.union([tt.UUID, t.null]),
  // Directly-resolved area when no equipment matched; equipmentId wins.
  areaId: t.union([tt.UUID, t.null]),
  // The mailbox conversation the ticket was raised from, when it was.
  mailboxConversationId: t.union([t.string, t.null]),
  // Member numbers of trainers currently assigned to the ticket.
  assignedMemberNumbers: t.readonlyArray(t.number),
  // One voting number per person; linked numbers count once.
  // The representative number may be a past member number.
  plusOneMemberNumbers: t.readonlyArray(t.number),
  response: TroubleTicketResponse,
});
export type TroubleTicket = t.TypeOf<typeof TroubleTicket>;
