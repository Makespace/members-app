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

export type ViewModel = {
  candidates: ReadonlyArray<CandidateRow>;
};
