import {DateTime} from 'luxon';
import {User} from '../../types';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';

type QuizID = UUID;

export type QuizResultViewModel = {
  id: QuizID;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  timestamp: DateTime;

  memberNumber: number;

  otherAttempts: ReadonlyArray<QuizID>;
};

export type QuizResultUnknownMemberViewModel = {
  id: QuizID;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  timestamp: DateTime;

  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
};

export type ViewModel = {
  user: User;
  isSuperUserOrOwnerOfArea: boolean;
  isSuperUserOrTrainerOfArea: boolean;
  equipment: {
    name: string;
    id: UUID;
    trainers: ReadonlyArray<number>;
    trainedMembers: ReadonlyArray<number>;
  };
  trainingQuizResults: {
    lastRefresh: O.Option<DateTime>;
    quizPassedNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
      unknownMember: ReadonlyArray<QuizResultUnknownMemberViewModel>;
    };
    failedQuizNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
    };
  };
};
