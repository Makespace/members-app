import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Dependencies } from "../../dependencies";
import { Logger } from "pino";
import { truncateTables } from "./state";

export const reset = (
    db: BetterSQLite3Database,
    logger: Logger,
    asyncRefresh: Dependencies['sharedReadModel']['asyncRefresh']
) => async (): Promise<void> => {
    logger.info('Resetting shared state, truncating all tables...');


    // TODO? Use a transaction here?


    truncateTables.forEach(
        table => db.run(table)
    );
    logger.info('Running async refresh...');
    await asyncRefresh()();
    logger.info('Finished resetting shared state');
};
