import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Logger } from "pino";
import { eventStateTable, truncateTables } from "./state";
import { Client } from "@libsql/client/.";
import { asyncRefresh } from "./async-refresh";
import { getCurrentEventIndex } from "./get-current-event-index";
import { updateState } from "./update-state";

export const reset = (
    eventDB: Client,
    readModelDB: BetterSQLite3Database,
    logger: Logger,
) => async (): Promise<void> => {
    logger.info('Resetting shared state, truncating all tables...');
    readModelDB.transaction((tx) => {
        truncateTables.forEach(statement => tx.run(statement));
        tx.insert(eventStateTable)
            .values({currentEventIndex: 0})
            .run();
    });
    logger.info('Running async refresh...');
    await asyncRefresh(
        eventDB,
        getCurrentEventIndex(readModelDB),
        updateState(readModelDB, logger, true)
    )()();
    logger.info('Finished resetting shared state');
};
