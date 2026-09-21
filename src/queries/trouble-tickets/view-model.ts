import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  TroubleTicketResponse,
  TroubleTicketStatus,
} from '../../types/trouble-ticket';

export type AssigneeView = {
  memberNumber: number;
  name: O.Option<string>;
};

type ChangeLogDetail = {label: string; value: string};

export type ChangeLogEntry = {
  at: Date;
  actor: string;
  // The action, e.g. "assigned themselves and set the ticket to In Progress".
  summary: string;
  details: ReadonlyArray<ChangeLogDetail>;
  // The ticket's status immediately after this change - used to tint the entry.
  status: TroubleTicketStatus;
};

export type TroubleTicketView = {
  id: UUID;
  title: string;
  status: TroubleTicketStatus;
  submittedAt: Date;
  submittedName: string | null;
  submittedMemberNumber: number | null;
  submittedEmail: string | null;
  // The resolved equipment's name; when none, areaName may still place the
  // ticket in an area. Both none = the Unassigned bucket.
  equipmentName: O.Option<string>;
  // The ticket's area: the equipment's area when a machine is resolved, else
  // the directly-mapped area.
  areaName: O.Option<string>;
  rawEquipment: string | null;
  response: TroubleTicketResponse;
  assignees: ReadonlyArray<AssigneeView>;
  // Relationship to the viewing member (drives the "show only" scope filters).
  assignedToMe: boolean;
  inMyOwnerArea: boolean;
  onMyTrainerMachine: boolean;
  // Whether the viewer may change this ticket's status (trainer on its machine, or a
  // super-user). Drives whether the action buttons are shown.
  canChangeStatus: boolean;
  // Human-readable history of status/assignment changes, oldest first.
  changeLog: ReadonlyArray<ChangeLogEntry>;
};

export type ViewModel = {
  tickets: ReadonlyArray<TroubleTicketView>;
  // Distinct raw form strings that failed to resolve to equipment, with
  // ticket counts - the work list for the alias mapping page.
  unresolvedEquipmentNames: ReadonlyArray<{raw: string; count: number}>;
  // Whether the viewer may register aliases (admin/super-user).
  canMapEquipment: boolean;
};
