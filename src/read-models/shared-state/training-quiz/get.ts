import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {trainingQuizCompletionsTable} from '../state';

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
