import {UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {EmailAddress} from '../../types';

// Just what renderMember needs, resolved from the row's member number / email.
export type ResolvedMember = {
  name: O.Option<string>;
  memberNumber: number;
  primaryEmailAddress: EmailAddress;
};

export type CandidateRow = {
  equipmentId: UUID;
  equipmentName: string;
  completedAt: Date;
  // Raw values from the sheet row (used as a fallback when the member can't be
  // resolved, e.g. a non-numeric membership number and an unknown email).
  email: O.Option<EmailAddress>;
  memberNumber: O.Option<number>;
  // The resolved member, if the number or email matches a known member.
  member: O.Option<ResolvedMember>;
  score: number;
  maxScore: number;
  rowHash: string;
  // The exact raw fields the event would store (JSON), for a "view raw" toggle.
  raw: string;
};

// One selectable machine in the picker.
type EquipmentChoice = {
  id: UUID;
  name: string;
};

// Machines that have a training sheet, grouped by area.
export type AreaGroup = {
  areaName: string;
  equipment: ReadonlyArray<EquipmentChoice>;
};

// The page has two modes so it never loads every machine's rows at once:
//  - 'picker': no machine selected -> just links, no candidate computation.
//  - 'selected': one machine chosen -> candidates for that machine's sheet only.
export type ViewModel =
  | {_tag: 'picker'; areas: ReadonlyArray<AreaGroup>}
  | {
      _tag: 'selected';
      equipmentName: string;
      candidates: ReadonlyArray<CandidateRow>;
    };
