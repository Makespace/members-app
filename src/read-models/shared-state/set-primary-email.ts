import { eq } from "drizzle-orm";
import { EmailAddress, UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { membersTable } from "./state";
import { gravatarHashFromEmail } from "../avatar";

export const setPrimaryEmailAddress = (
  tx: DatabaseTransaction,
  userId: UserId,
  emailAddress: EmailAddress
) =>
    tx
      .update(membersTable)
      .set({
        primaryEmailAddress: emailAddress,
        gravatarHash: gravatarHashFromEmail(emailAddress),
      })
      .where(eq(membersTable.userId, userId))
      .run();
