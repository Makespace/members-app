import * as O from 'fp-ts/Option';
import {EmailAddress, GravatarHash} from '../../types';

type OrphanedPassedQuiz = {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  timestamp: Date;

  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
};

type FailedQuizAttempt = MemberCoreInfo & {
  quizId: string;
  score: number;
  maxScore: number;
  percentage: number;
  timestamp: Date;
  quizAnswers: unknown;
};

type TrainedMember = MemberCoreInfo & {
  trainedBy: number | null;
  trainedAt: Date;
};

export type Equipment = {
  id: string;
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
};

type TrainedOn = {
  id: string;
  name: string;
  trainedAt: Date;
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

type MemberAwaitingTraining = MemberCoreInfo & {
  quizId: string;
  memberNumber: number;
  waitingSince: Date;
};

export type Member = MemberCoreInfo & {
  trainedOn: ReadonlyArray<TrainedOn>;
  ownerOf: ReadonlyArray<OwnerOf>;
};
