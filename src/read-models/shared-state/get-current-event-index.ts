import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eventStateTable } from "./state";
import { Int } from "io-ts";

export const getCurrentEventIndex = (db: BetterSQLite3Database) => (): Int => {
    const rows = db.select({
        index: eventStateTable.currentEventIndex
    })
    .from(eventStateTable)
    .all();

    // We can assume that this is always populated as this is done when the table is initalised.
    return rows[0].index as Int;
};
