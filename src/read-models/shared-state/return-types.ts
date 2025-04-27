import * as O from 'fp-ts/Option';
import {Actor, EmailAddress, GravatarHash} from '../../types';
import {UUID} from 'io-ts-types';

export type OrphanedPassedQuiz = {
  id: UUID;
  score: number;
  maxScore: number;
  percentage: number;
  timestamp: Date;

  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
};

export type FailedQuizAttempt = MemberCoreInfo & {
  quizId: UUID;
  score: number;
  maxScore: number;
  percentage: number;
  timestamp: Date;
};

export type TrainedMember = MemberCoreInfo & {
  markedTrainedByActor: O.Option<Actor>;
  trainedByMemberNumber: O.Option<number>;
  trainedByEmail: O.Option<EmailAddress>;
  trainedSince: Date;
  legacyImport: boolean;
};

export type EpochTimestampMilliseconds = number & {
  readonly EpochTimestampMilliseconds: unique symbol;
};

export type TrainerInfo = MemberCoreInfo & {
  markedTrainerByActor: O.Option<Actor>;
  trainerSince: Date;
};

export type MinimalEquipment = {
  id: UUID;
  name: string;
  areaId: UUID;
  trainingSheetId: O.Option<string>;
  // Uses local timestamp.
  lastQuizSync: O.Option<EpochTimestampMilliseconds>;
};

export type Equipment = {
  trainers: ReadonlyArray<TrainerInfo>;
  trainedMembers: ReadonlyArray<TrainedMember>;
  area: MinimalArea;
  membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  orphanedPassedQuizes: ReadonlyArray<OrphanedPassedQuiz>;
  failedQuizAttempts: ReadonlyArray<FailedQuizAttempt>;
  // Uses the actual spreadsheet timestamp rather than our local timestamp which could be
  // different due to clock drift or eventual consistency issues on the google side.
  lastQuizResult: O.Option<EpochTimestampMilliseconds>;
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
  memberNumbers: number[];
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

export type MemberAwaitingTraining = MemberCoreInfo & {
  quizId: UUID;
  waitingSince: Date;
};

export type Member = MemberCoreInfo & {
  trainedOn: ReadonlyArray<TrainedOn>;
  trainerFor: ReadonlyArray<TrainerFor>;
  ownerOf: ReadonlyArray<OwnerOf>;
};

export type MinimalArea = {
  id: UUID;
  name: string;
};

export type Owner = MemberCoreInfo & {
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
