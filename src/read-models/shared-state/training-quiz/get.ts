import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, gt} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {trainingQuizCompletionsTable} from '../state';

// One imported quiz completion, from the event-sourced read model. Raw sheet
// facts only - member/equipment resolution happens in the consumers.
export type TrainingQuizCompletionRow = {
  rowHash: string;
  trainingSheetId: string;
  completedAt: Date;
  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
  score: number;
  maxScore: number;
};

const rowToCompletion = (row: {
  rowHash: string;
  trainingSheetId: string;
  completedAt: Date;
  memberNumberProvided: number | null;
  emailProvided: string | null;
  score: number;
  maxScore: number;
}): TrainingQuizCompletionRow => ({
  rowHash: row.rowHash,
  trainingSheetId: row.trainingSheetId,
  completedAt: row.completedAt,
  memberNumberProvided: O.fromNullable(row.memberNumberProvided),
  emailProvided: O.fromNullable(row.emailProvided),
  score: row.score,
  maxScore: row.maxScore,
});

// Completions for one training sheet, optionally only those completed strictly
// after `since` (matching the sheet cache's `gt` window). Uses the
// trainingSheetId index.
export const getCompletionsForSheet =
  (db: BetterSQLite3Database) =>
  (
    trainingSheetId: string,
    since: O.Option<Date>
  ): ReadonlyArray<TrainingQuizCompletionRow> =>
    db
      .select()
      .from(trainingQuizCompletionsTable)
      .where(
        O.isSome(since)
          ? and(
              eq(trainingQuizCompletionsTable.trainingSheetId, trainingSheetId),
              gt(trainingQuizCompletionsTable.completedAt, since.value)
            )
          : eq(trainingQuizCompletionsTable.trainingSheetId, trainingSheetId)
      )
      .all()
      .map(rowToCompletion);

// All completions a member number was recorded against (whole history - no
// window, matching the member page today). Uses the memberNumberProvided index.
export const getCompletionsForMember =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): ReadonlyArray<TrainingQuizCompletionRow> =>
    db
      .select()
      .from(trainingQuizCompletionsTable)
      .where(
        eq(trainingQuizCompletionsTable.memberNumberProvided, memberNumber)
      )
      .all()
      .map(rowToCompletion);

// Has a quiz row with this hash already been imported as an event?
export const hasQuizRowHash =
  (db: BetterSQLite3Database) =>
  (rowHash: string): boolean =>
    db
      .select({rowHash: trainingQuizCompletionsTable.rowHash})
      .from(trainingQuizCompletionsTable)
      .where(eq(trainingQuizCompletionsTable.rowHash, rowHash))
      .get() !== undefined;

// All imported row hashes - used to filter already-imported rows out of the
// dry-run page in one pass.
export const getImportedQuizRowHashes =
  (db: BetterSQLite3Database) =>
  (): ReadonlySet<string> =>
    new Set(
      db
        .select({rowHash: trainingQuizCompletionsTable.rowHash})
        .from(trainingQuizCompletionsTable)
        .all()
        .map(row => row.rowHash)
    );
