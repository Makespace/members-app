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

export type TroubleTicketView = {
  id: UUID;
  title: string;
  status: TroubleTicketStatus;
  submittedAt: Date;
  submittedName: string | null;
  submittedMemberNumber: number | null;
  submittedEmail: string | null;
  // The resolved equipment's name; none means the ticket is in the Unassigned bucket.
  equipmentName: O.Option<string>;
  rawEquipment: string | null;
  response: TroubleTicketResponse;
  assignees: ReadonlyArray<AssigneeView>;
};

export type ViewModel = {
  tickets: ReadonlyArray<TroubleTicketView>;
};
