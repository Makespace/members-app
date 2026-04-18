import { eq } from "drizzle-orm";
import { UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { membersTable } from "./state";

export const revokeSuperuser = (tx: DatabaseTransaction, userId: UserId) =>
  tx
    .update(membersTable)
    .set({isSuperUser: false, superUserSince: null})
    .where(eq(membersTable.userId, userId))
    .run();
