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
  trainedSince: Date;
};

export type EpochTimestampMilliseconds = number & {
  readonly EpochTimestampMilliseconds: unique symbol;
};

export type TrainerInfo = MemberCoreInfo & {
  markedTrainerByActor: O.Option<Actor>;
  trainerSince: Date;
};

export type MinimalEquipment = {
  id: string;
  name: string;
  trainingSheetId: O.Option<string>;
  // Uses local timestamp.
  lastQuizSync: O.Option<EpochTimestampMilliseconds>;
};

export type Equipment = {
  trainers: ReadonlyArray<TrainerInfo>;
  trainedMembers: ReadonlyArray<TrainedMember>;
  area: O.Option<MinimalArea>;
  membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  orphanedPassedQuizes: ReadonlyArray<OrphanedPassedQuiz>;
  failedQuizAttempts: ReadonlyArray<FailedQuizAttempt>;
  // Uses the actual spreadsheet timestamp rather than our local timestamp which could be
  // different due to clock drift or eventual consistency issues on the google side.
  lastQuizResult: O.Option<EpochTimestampMilliseconds>;
} & MinimalEquipment;

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

type MemberCoreInfo = {
  memberNumber: number;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  gravatarHash: GravatarHash;
};

export type MemberAwaitingTraining = MemberCoreInfo & {
  quizId: UUID;
  memberNumber: number;
  waitingSince: Date;
};

export type Member = MemberCoreInfo & {
  trainedOn: ReadonlyArray<TrainedOn>;
  trainerFor: ReadonlyArray<TrainerFor>;
  ownerOf: ReadonlyArray<OwnerOf>;
};

export type MinimalArea = {
  id: string;
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
