import * as O from 'fp-ts/Option';
import {Actor, EmailAddress, GravatarHash} from '../../types';
import {UUID} from 'io-ts-types';

export type TrainedMember = Pick<
  MemberCoreInfo,
  'name' | 'memberNumber' | 'emailAddress' | 'pastMemberNumbers'
> & {
  markedTrainedByActor: O.Option<Actor>;
  trainedByMemberNumber: O.Option<number>;
  trainedByEmail: O.Option<EmailAddress>;
  trainedSince: Date;
  legacyImport: boolean;
};

export type TrainerInfo = Pick<
  MemberCoreInfo,
  'name' | 'memberNumber' | 'emailAddress' | 'pastMemberNumbers'
> & {
  markedTrainerByActor: O.Option<Actor>;
  trainerSince: Date;
};

export type MinimalEquipment = {
  id: UUID;
  name: string;
  areaId: UUID;
  trainingSheetId: O.Option<string>;
};

export type Equipment = {
  trainers: ReadonlyArray<TrainerInfo>;
  trainedMembers: ReadonlyArray<TrainedMember>;
  area: MinimalArea;
} & Omit<MinimalEquipment, 'areaId'>;

export type TrainedOn = {
  id: string;
  name: string;
  trainedAt: Date;
};

export type TrainerFor = {
  equipment_id: UUID;
  equipment_name: string;
  since: Date;
};

export type OwnerOf = {
  id: string;
  name: string;
  ownershipRecordedAt: Date;
};

export type MemberCoreInfo = {
  memberNumber: number;
  pastMemberNumbers: ReadonlyArray<number>;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  formOfAddress: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  superUserSince: O.Option<Date>;
  gravatarHash: GravatarHash;
  status: string;
};

export const allMemberNumbers = (
  m: Pick<MemberCoreInfo, 'memberNumber' | 'pastMemberNumbers'>
): ReadonlyArray<number> => [m.memberNumber, ...m.pastMemberNumbers];

export type Member = MemberCoreInfo & {
  trainedOn: ReadonlyArray<TrainedOn>;
  trainerFor: ReadonlyArray<TrainerFor>;
  ownerOf: ReadonlyArray<OwnerOf>;
};

export type MinimalArea = {
  id: UUID;
  name: string;
};

export type Owner = Pick<
  MemberCoreInfo,
  'memberNumber' | 'name' | 'emailAddress' | 'pastMemberNumbers'
> & {
  ownershipRecordedAt: Date;
  markedOwnerBy: O.Option<Actor>;
};

export type Area = MinimalArea & {
  owners: ReadonlyArray<Owner>;
  equipment: ReadonlyArray<Equipment>;
};

export type TroubleTicket = {
  responseSubmitted: Date;
  emailAddress: O.Option<string>;
  whichEquipment: O.Option<string>;
  submitterName: O.Option<string>;
  submitterMembershipNumber: O.Option<number>;
  submittedResponse: unknown;
};
