import * as O from 'fp-ts/Option';
import {EmailAddress, GravatarHash} from '../../types';
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

type TrainedMember = MemberCoreInfo & {
  trainedBy: number | null;
  trainedAt: Date;
};

export type EpochTimestampMilliseconds = number & {
  readonly EpochTimestampMilliseconds: unique symbol;
};

export type Equipment = {
  id: UUID;
  name: string;
  trainers: ReadonlyArray<MemberCoreInfo>;
  trainedMembers: ReadonlyArray<TrainedMember>;
  area: {
    id: string;
    name: string;
  };
  membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  orphanedPassedQuizes: ReadonlyArray<OrphanedPassedQuiz>;
  failedQuizAttempts: ReadonlyArray<FailedQuizAttempt>;
  trainingSheetId: O.Option<string>;

  // Uses the actual spreadsheet timestamp rather than our local timestamp which could be
  // different due to clock drift or eventual consistency issues on the google side.
  lastQuizResult: O.Option<EpochTimestampMilliseconds>;
  // Uses local timestamp.
  lastQuizSync: O.Option<EpochTimestampMilliseconds>;
};

type TrainedOn = {
  id: string;
  name: string;
  trainedAt: Date;
};

type TrainerFor = {
  equipment_id: UUID;
  equipment_name: string;
  since: Date;
};

type OwnerOf = {
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
