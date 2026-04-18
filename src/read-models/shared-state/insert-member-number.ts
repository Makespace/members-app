import { UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { memberNumbersTable } from "./state";

export const insertMemberNumber = (
  tx: DatabaseTransaction,
  memberNumber: number,
  userId: UserId
) => {
  tx
    .insert(memberNumbersTable)
    .values({memberNumber, userId})
    .onConflictDoNothing()
    .run();
};
