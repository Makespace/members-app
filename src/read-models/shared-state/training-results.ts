// Similar to the main shared-state but since the data comes from
// google rather than the database its written separately initially.

import * as O from 'fp-ts/Option';
import { GoogleAuth } from 'google-auth-library';
import { DateTime } from 'luxon';
import { SharedReadModel } from '.';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { UUID } from 'io-ts-types';

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

export interface TrainingQuizResults {
    lastRefresh: O.Option<DateTime>;
    quizPassedNotTrained: {
        knownMember: ReadonlyArray<QuizResultViewModel>;
        unknownMember: ReadonlyArray<QuizResultUnknownMemberViewModel>;
    };
    failedQuizNotTrained: {
        knownMember: ReadonlyArray<QuizResultViewModel>;
    };
}

export const getTrainingQuizResults = (db: BetterSQLite3Database): SharedReadModel['equipment']['getTrainingQuizResults'] => async (equipmentId: string): Promise<O.Option<TrainingQuizResults>> => {
    
}