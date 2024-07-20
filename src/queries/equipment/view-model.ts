import {DateTime} from 'luxon';
import {User} from '../../types';
import * as O from 'fp-ts/Option';

type QuizID = string;

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
    id: string;
    trainers: ReadonlyArray<number>;
    trainedMembers: ReadonlyArray<number>;
  };
  trainingQuizResults: {
    quizPassedNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
      unknownMember: ReadonlyArray<QuizResultUnknownMemberViewModel>;
    };
    failedQuizNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
    };
  };
};
