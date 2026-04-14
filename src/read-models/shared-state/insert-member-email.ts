import { EmailAddress, UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { memberEmailsTable } from "./state";

export const insertMemberEmail = (
  tx: DatabaseTransaction,
  userId: UserId,
  emailAddress: EmailAddress,
  addedAt: Date,
  verifiedAt: Date | null
) =>
  tx
    .insert(memberEmailsTable)
    .values({
      userId,
      emailAddress,
      addedAt,
      verifiedAt: verifiedAt ?? undefined,
    })
    .onConflictDoNothing()
    .run();
