import { UserId } from "../../types";
import { DatabaseTransaction } from "./database-transaction";
import { InconsistentEventError } from "./inconsistent-event-error";
import { insertMemberNumber } from "./insert-member-number";
import * as O from 'fp-ts/Option';
import { revokeSuperuser } from "./revoke-super-user";
import { memberEmailsTable, memberNumbersTable, membersTable, ownersTable, trainedMemberstable, trainersTable, trainingStatsNotificationTable } from "./state";
import {eq} from 'drizzle-orm';
import { dropRecordsByUserId } from "./drop-records";
import { findUserIdByMemberNumber } from "./member/get";

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

  if (
    (newRecordNotifications.lastEmailSent?.getTime() ?? 0) >
    (oldRecordNotifications.lastEmailSent?.getTime() ?? 0)
  ) {
    tx.update(trainingStatsNotificationTable)
      .set({lastEmailSent: newRecordNotifications.lastEmailSent})
      .where(eq(trainingStatsNotificationTable.userId, oldUserId))
      .run();
  }

  tx.delete(trainingStatsNotificationTable)
    .where(eq(trainingStatsNotificationTable.userId, newUserId))
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

  const newMember = tx
    .select()
    .from(membersTable)
    .where(eq(membersTable.userId, newUserId))
    .get();

  if (newMember) {
    // Member details are updated with some of the details from the newer
    // account.
    tx.update(membersTable)
      .set({
        primaryEmailAddress: newMember.primaryEmailAddress,
        gravatarHash: newMember.gravatarHash,
        name: newMember.name,
        formOfAddress: newMember.formOfAddress,
      })
      .where(eq(membersTable.userId, oldUserId))
      .run();
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
  if (oldMemberNumber === newMemberNumber) {
    return;
  }

  if (oldMemberNumber > newMemberNumber) {
    throw new InconsistentEventError(`Cannot add new member number '${newMemberNumber}' to old member record '${oldMemberNumber}' as old number is later than new number`);
  }

  const oldUserId = findUserIdByMemberNumber(tx)(oldMemberNumber);
  const newUserId = findUserIdByMemberNumber(tx)(newMemberNumber);

  if (O.isNone(oldUserId)) {
    throw new InconsistentEventError(`Cannot add member number '${newMemberNumber}' to unknown existing user '${oldMemberNumber}'`);
  }

  if (O.isNone(newUserId)) {
    // Simple case as nothing to move over.
    insertMemberNumber(tx, newMemberNumber, oldUserId.value);
    revokeSuperuser(tx, oldUserId.value);
    // Grab any orphaned training records that now have a parent.
    // DEVNOTE - THIS IS INTENTIONALLY DISABLED TO SEE EFFECT
    // tx.update(trainedMemberstable)
    //   .set({userId: oldUserId.value})
    //   .where(
    //     and(
    //       eq(trainedMemberstable.memberNumber, newMemberNumber),
    //       isNull(trainedMemberstable.userId)
    //     )
    //   )
    //   .run();
    // // 
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
