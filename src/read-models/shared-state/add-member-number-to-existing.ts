import { UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { InconsistentEventError } from "./inconsistent-event-error";
import { insertMemberNumber } from "./insert-member-number";
import { findUserId } from "./member/get";
import * as O from 'fp-ts/Option';
import { revokeSuperuser } from "./revoke-super-user";
import { memberEmailsTable, memberNumbersTable, ownersTable, trainedMemberstable, trainersTable, trainingStatsNotificationTable } from "./state";
import {eq} from 'drizzle-orm';
import { dropRecordsByUserId } from "./drop-records";

const mergeTrainingStatNotification = (
  tx: DatabaseTransaction,
  oldUserId: UserId,
  newUserId: UserId
) => {
  const oldRecordNotifications = tx
    .select()
    .from(trainingStatsNotificationTable)
    .where(eq(trainingStatsNotificationTable.userId, oldUserId))
    .get();
  const newRecordNotifications = tx
    .select()
    .from(trainingStatsNotificationTable)
    .where(eq(trainingStatsNotificationTable.userId, newUserId))
    .get();
  if (!newRecordNotifications) {
    // Nothing to update.
    return;
  }
  if (!oldRecordNotifications) {
    // We just need to update the new record.
    tx.update(trainingStatsNotificationTable)
        .set({userId: oldUserId})
        .where(eq(trainingStatsNotificationTable.userId, newUserId))
        .run();
    return;
  }
  // We need to find the latest last email sent time and update that.
  const oldRecordLastSent = oldRecordNotifications.lastEmailSent?.getTime() ?? 0;
  const newRecordLastSent = newRecordNotifications.lastEmailSent?.getTime() ?? 0;

  if (oldRecordLastSent > newRecordLastSent) {
    // The old record already has the latest time so nothing to update.
    return;
  }
  // The old record needs to be updated with the latest time.
  tx.update(trainingStatsNotificationTable)
    .set({lastEmailSent: newRecordNotifications.lastEmailSent})
    .where(eq(trainingStatsNotificationTable.userId, oldUserId))
    .run();
};

const mergeUsers = (
  tx: DatabaseTransaction,
  oldUserId: UserId,
  newUserId: UserId
) => {
  if (oldUserId === newUserId) {
    return;
  }

  tx.update(memberEmailsTable)
    .set({userId: oldUserId})
    .where(eq(memberEmailsTable.userId, newUserId))
    .run();
  tx.update(memberNumbersTable)
    .set({userId: oldUserId})
    .where(eq(memberNumbersTable.userId, newUserId))
    .run();
  tx.update(ownersTable)
    .set({userId: oldUserId})
    .where(eq(ownersTable.userId, newUserId))
    .run();
  tx.update(trainersTable)
    .set({userId: oldUserId})
    .where(eq(trainersTable.userId, newUserId))
    .run();
  tx.update(trainedMemberstable)
    .set({userId: oldUserId})
    .where(eq(trainedMemberstable.userId, newUserId))
    .run();
  mergeTrainingStatNotification(tx, oldUserId, newUserId);
  dropRecordsByUserId(tx, newUserId);
  
};

export const addMemberNumberToExisting = (
  tx: DatabaseTransaction,
  oldMemberNumber: number,
  newMemberNumber: number
) => {
  // If a user has 2 different membership numbers then we move all the records from the new member
  // and add it onto their old record.

  if (oldMemberNumber > newMemberNumber) {
    throw new InconsistentEventError(`Cannot add new member number '${newMemberNumber}' to old member record '${oldMemberNumber}' as old number is later than new number`);
  }

  const oldUserId = findUserId(tx, oldMemberNumber);
  const newUserId = findUserId(tx, newMemberNumber);

  if (O.isNone(oldUserId)) {
    throw new InconsistentEventError(`Cannot add member number '${newMemberNumber}' to unknown existing user '${oldMemberNumber}'`);
  }

  if (O.isNone(newUserId)) {
    // Simple case as nothing to move over.
    insertMemberNumber(tx, newMemberNumber, oldUserId.value);
    return;
  }

  // There might be old records so we need to merge the users.
  // We should avoid how much this needs to do by adding member number to existing
  // as early as possible.

  mergeUsers(tx, oldUserId.value, newUserId.value);
  insertMemberNumber(tx, oldMemberNumber, oldUserId.value);
  insertMemberNumber(tx, newMemberNumber, oldUserId.value);
  revokeSuperuser(tx, oldUserId.value);
};
