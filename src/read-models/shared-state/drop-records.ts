import { eq } from "drizzle-orm";
import { UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { membersTable } from "./state";

export const dropRecordsByUserId = (tx: DatabaseTransaction, userId: UserId) => {
    tx.delete(membersTable)
        .where(eq(membersTable.userId, userId))
        .run();
};

