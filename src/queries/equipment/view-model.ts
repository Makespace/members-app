import {DateTime} from 'luxon';
import {User} from '../../types';

export type QuizResultViewModel = {
  email: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  timestamp: DateTime;
};

export type ViewModel = {
  user: User;
  equipment: {
    name: string;
    id: string;
    trainers: ReadonlyArray<number>;
  };
  trainingQuizResults: {
    passed: ReadonlyArray<QuizResultViewModel>;
    all: ReadonlyArray<QuizResultViewModel>;
  };
};
