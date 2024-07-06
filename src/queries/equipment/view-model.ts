import {DateTime} from 'luxon';
import {User} from '../../types';

export type QuizID = string;

export type QuizResultViewModel = {
  id: QuizID;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  timestamp: DateTime;
  previousAttempts: QuizID[];

  emailProvided: string;
  memberNumberProvided: number;

  memberNumberFound: boolean;
  emailMemberNumber: number | null;

  memberDetailsMatch: boolean;
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
    // Each member should only appear in one of these to avoid confusion.
    quiz_passed_not_trained: ReadonlyArray<QuizResultViewModel>;
    failed_quiz_not_passed: ReadonlyArray<QuizResultViewModel>;
  };
};
