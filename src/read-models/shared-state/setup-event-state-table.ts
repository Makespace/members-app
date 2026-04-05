import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eventStateTable } from "./state";

export const setupEventStateTable = (db: BetterSQLite3Database) => {
    db.insert(eventStateTable)
    .values({
        currentEventIndex: 0
    })
    .run();
};

