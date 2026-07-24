import {DomainEvent, StoredDomainEvent} from '../../types/domain-event';
import * as O from 'fp-ts/Option';
import {
  areasTable,
  equipmentTable,
  eventStateTable,
  failedEventsTable,
  memberEmailsTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
  trainingStatsNotificationTable,
  troubleTicketsTable,
  troubleTicketAssigneesTable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, inArray, isNull, sql} from 'drizzle-orm';
import {isOwnerOfAreaContainingEquipment} from './area/helpers';
import {normaliseEmailAddress} from './normalise-email-address';
import {Logger} from 'pino';
import { DatabaseTransaction } from './database-transaction';
import { addMemberNumberToExisting } from './add-member-number-to-existing';
import { revokeSuperuser } from './revoke-super-user';
import { findUserIdByMemberNumber, findUserIdByEmail } from './member/get';
import { InconsistentEventError } from './inconsistent-event-error';
import { insertMemberNumber } from './insert-member-number';
import { insertMemberEmail } from './insert-member-email';
import { setPrimaryEmailAddress } from './set-primary-email';
import { getEquipmentMinimal, resolveEquipmentByName } from './equipment/get';
import { generateUserId } from './member/generate-user-id';
import { gravatarHashFromEmail } from '../avatar';

const _updateState =
  (tx: DatabaseTransaction, event: DomainEvent) => {
    switch (event.type) {
      case 'MemberNumberLinkedToEmail': {
        const normalisedEmailAddress = normaliseEmailAddress(event.email);
        const existingUserId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isSome(existingUserId)) {
          throw new InconsistentEventError(
            `Attempted to link email '${event.email}' to '${event.memberNumber}' but that member number already exists as user id '${existingUserId.value}'`
          );
        }
        const existingMember = findUserIdByEmail(tx)(normalisedEmailAddress, false);
        if (O.isSome(existingMember)) {
          throw new InconsistentEventError(
            `Attempted to link email '${event.email}' to ${event.memberNumber} but that email already exists as user id '${existingMember.value}'`
          );
        }

        const newUserId = generateUserId(event.memberNumber);
        tx.insert(membersTable)
          .values({
            userId: newUserId,
            primaryEmailAddress: normalisedEmailAddress,
            gravatarHash: gravatarHashFromEmail(normalisedEmailAddress),
            name: O.fromNullable(event.name),
            formOfAddress: O.fromNullable(event.formOfAddress),
            isSuperUser: false,
            agreementSigned: undefined,
            superUserSince: undefined,
            joined: event.recordedAt,
          })
          .run();
        insertMemberNumber(tx, event.memberNumber, newUserId);
        insertMemberEmail(
          tx,
          newUserId,
          normalisedEmailAddress,
          event.recordedAt,
          event.recordedAt,
        );
        setPrimaryEmailAddress(tx, newUserId, normalisedEmailAddress);

        // DEVNOTE - THIS IS INTENTIONALLY DISABLED TO SEE EFFECT
        // Grab any member trained on records that were created before the user was registered.
        // This is needed due to the legacy training import.
        // tx.update(trainedMemberstable)
        //   .set({userId: newUserId})
        //   .where(
        //     and(
        //       eq(trainedMemberstable.memberNumber, event.memberNumber),
        //       isNull(trainedMemberstable.userId)
        //     )
        //   )
        //   .run();
        // 
        break;
      }
      case 'MemberEmailAdded': {
        const normalisedEmailAddress = normaliseEmailAddress(event.email);
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to add email '${normalisedEmailAddress}', unknown member number: '${event.memberNumber}'`);
        }
        const existingEmailUsage = findUserIdByEmail(tx)(normalisedEmailAddress, false);
        if (O.isSome(existingEmailUsage)) {
          throw new InconsistentEventError(
            `Attempted to link email '${event.email}' to ${event.memberNumber} but that email already exists on user id '${existingEmailUsage.value}'`
          );
        }
        insertMemberEmail(
          tx,
          userId.value,
          normalisedEmailAddress,
          event.recordedAt,
          null,
        );
        break;
      }
      case 'MemberEmailVerified': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to verify email, unknown member number: '${event.memberNumber}'`);
        }
        const rows = tx.update(memberEmailsTable)
          .set({verifiedAt: event.recordedAt})
          .where(
            and(
              eq(memberEmailsTable.userId, userId.value),
              eq(
                memberEmailsTable.emailAddress,
                normaliseEmailAddress(event.email)
              )
            )
          )
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(
            `Unable to verify email '${event.email}' for member number: '${event.memberNumber}' - unknown email address`
          )
        }
        break;
      }
      case 'MemberPrimaryEmailChanged': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to set primary email to '${event.email}', unknown member number: '${event.memberNumber}'`);
        }
        const normalisedEmailAddress = normaliseEmailAddress(event.email);
        const userIdByEmail = findUserIdByEmail(tx)(normalisedEmailAddress, false);
        if (O.isSome(userIdByEmail)) {
          if (userIdByEmail.value !== userId.value) {
            throw new InconsistentEventError(
              `Attempted to set email '${event.email}' as primary email for ${userId.value} when its registered to ${userIdByEmail.value} already`
            )
          }
        } else {
          throw new InconsistentEventError(
            `Attempted to set unknown email '${event.email}' as primary email for ${userId.value}`
          )
        }
        setPrimaryEmailAddress(
          tx,
          userId.value,
          normalisedEmailAddress
        );
        break;
      }
      case 'MemberEmailVerificationRequested': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to update email verification requested for '${event.email}', unknown member number: '${event.memberNumber}'`);
        }
        const rows = tx.update(memberEmailsTable)
          .set({
            verificationLastSent: event.recordedAt
          })
          .where(
            and(
              eq(memberEmailsTable.userId, userId.value),
              eq(memberEmailsTable.emailAddress, normaliseEmailAddress(event.email))
            )
          )
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(
            `Unable to update email verification requested '${event.email}' for member number: '${event.memberNumber}' - unknown email address`
          )
        }
        break;
      }
      case 'MemberDetailsUpdated': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to update member details, unknown member number: '${event.memberNumber}'`);
        }
        if (event.name) {
          tx.update(membersTable)
            .set({name: O.some(event.name)})
            .where(eq(membersTable.userId, userId.value))
            .run();
        }
        if (event.formOfAddress) {
          tx.update(membersTable)
            .set({formOfAddress: O.some(event.formOfAddress)})
            .where(eq(membersTable.userId, userId.value))
            .run();
        }
        break;
      }
      case 'SuperUserDeclared': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to set as superuser, unknown member number: '${event.memberNumber}'`);
        }
        tx.update(membersTable)
          .set({isSuperUser: true, superUserSince: event.recordedAt})
          .where(eq(membersTable.userId, userId.value))
          .run();
        break;
      }
      case 'SuperUserRevoked': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to revoke superuser, unknown member number: '${event.memberNumber}'`);
        }
        revokeSuperuser(tx, userId.value);
        break;
      }
      case 'EquipmentAdded': {
        tx.insert(equipmentTable)
          .values({id: event.id, name: event.name, areaId: event.areaId})
          .run();
        break;
      }
      case 'TrainerAdded': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to add trainer, unknown member number: '${event.memberNumber}'`);
        }
        if (!isOwnerOfAreaContainingEquipment(tx)(event.equipmentId, userId.value)) {
          throw new InconsistentEventError(`Unable to add trainer, user '${userId.value}' is not an owner of the equipment '${event.equipmentId}'`);
        }
        tx.insert(trainersTable)
          .values({
            userId: userId.value,
            equipmentId: event.equipmentId,
            since: event.recordedAt,
            markedTrainerByActor: event.actor,
          })
          .onConflictDoNothing({
            target: [trainersTable.userId, trainersTable.equipmentId],
          })
          .run();
        break;
      }
      case 'MemberTrainedOnEquipment': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);

        // DEVNOTE - THIS IS INTENTIONALLY ENABLED TO SEE EFFECT
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to mark member trained on equipment '${event.equipmentId}', unknown member number: '${event.memberNumber}'`);
        }
        // This invalidates the memberClause bit below because userId will always be Some.

        if (O.isNone(getEquipmentMinimal(tx)(event.equipmentId))) {
          throw new InconsistentEventError(`Unable to mark member trained on equipment '${event.equipmentId}', unknown equipment`);
        }
        // We allow creating 'orphaned' member trained on events to handle the case that a member was marked trained before
        // their record was created during legacy import.
        const memberClause = O.isSome(userId)
          ? eq(trainedMemberstable.userId, userId.value)
          : and(
              isNull(trainedMemberstable.userId),
              eq(trainedMemberstable.memberNumber, event.memberNumber)
            );
        const existingRowClause = and(
          eq(trainedMemberstable.equipmentId, event.equipmentId),
          memberClause
        );
        const existing = O.fromNullable(
          tx
            .select()
            .from(trainedMemberstable)
            .where(existingRowClause)
            .limit(1)
            .get()
        );
        // A bug was previously found here because the trainedAt value from the database
        // truncates the milliseconds in the date. This leads to 2 completely duplicate events
        // appearing different because the times are different (by < 1000 milliseconds). To prevent
        // this we decrease the trainedAt time value by 1000ms. This does mean 2 non-duplicate events
        // within 1s of each other won't progress further but that doesn't matter for the use-case and
        // the information to resolve is lost by the db milliseconds truncation anyway.
        if (
          O.isSome(existing) &&
          existing.value.trainedAt.getTime() - 1000 < event.recordedAt.getTime()
        ) {
          // If we have already marked this member as trained in the past then
          // don't re-mark them as this would refresh their 'trained since'.
          break;
        }

        if (O.isSome(existing)) {
          tx.update(trainedMemberstable)
            .set({
              trainedAt: event.recordedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: event.legacyImport,
              markTrainedByActor: event.actor,
            })
            .where(existingRowClause)
            .run();
          break;
        }

        tx.insert(trainedMemberstable)
          .values({
            userId: O.toNullable(userId),
            memberNumber: event.memberNumber,
            equipmentId: event.equipmentId,
            trainedAt: event.recordedAt,
            trainedByMemberNumber: event.trainedByMemberNumber,
            legacyImport: event.legacyImport,
            markTrainedByActor: event.actor,
          })
          .run();
        break;
      }
      case 'MemberTrainedOnEquipmentBy': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to mark member trained on equipment '${event.equipmentId}', unknown member number: '${event.memberNumber}'`);
        }
        if (O.isNone(getEquipmentMinimal(tx)(event.equipmentId))) {
          throw new InconsistentEventError(`Unable to mark member trained on equipment '${event.equipmentId}', unknown equipment`);
        }

        // Note that we don't have any legacy 'MemberTrainedOnEquipmentBy' imports so therefore don't need to handle the case of an orphaned
        // MemberTrainedOnEquipmentBy events.
        const existingRowClause = and(
          eq(trainedMemberstable.equipmentId, event.equipmentId),
          eq(trainedMemberstable.userId, userId.value)
        );
        const existing = O.fromNullable(
          tx
            .select()
            .from(trainedMemberstable)
            .where(existingRowClause)
            .limit(1)
            .get()
        );
        // A bug was previously found here because the trainedAt value from the database
        // truncates the milliseconds in the date. This leads to 2 completely duplicate events
        // appearing different because the times are different (by < 1000 milliseconds). To prevent
        // this we decrease the trainedAt time value by 1000ms. This does mean 2 non-duplicate events
        // within 1s of each other won't progress further but that doesn't matter for the use-case and
        // the information to resolve is lost by the db milliseconds truncation anyway.
        if (
          O.isSome(existing) &&
          existing.value.trainedAt.getTime() - 1000 < event.trainedAt.getTime()
        ) {
          // If we have already marked this member as trained in the past then
          // don't re-mark them as this would refresh their 'trained since'.
          break;
        }
        if (O.isSome(existing)) {
          tx.update(trainedMemberstable)
            .set({
              trainedAt: event.trainedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: false,
              markTrainedByActor: event.actor,
            })
            .where(existingRowClause)
            .run();
          break;
        }
        tx.insert(trainedMemberstable)
          .values({
            userId: userId.value,
            memberNumber: event.memberNumber,
            equipmentId: event.equipmentId,
            trainedAt: event.trainedAt,
            trainedByMemberNumber: event.trainedByMemberNumber,
            legacyImport: false,
            markTrainedByActor: event.actor,
          })
          .run();
        break;
      }
      case 'OwnerAgreementSigned': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to mark owner agreement signed, unknown member number: '${event.memberNumber}'`);
        }
        tx.update(membersTable)
          .set({agreementSigned: event.signedAt})
          .where(eq(membersTable.userId, userId.value))
          .run();
        break;
      }
      case 'AreaCreated': {
        tx.insert(areasTable).values({id: event.id, name: event.name}).run();
        break;
      }
      case 'AreaRemoved': {
        tx.delete(areasTable).where(eq(areasTable.id, event.id)).run();
        break;
      }
      case 'AreaEmailUpdated': {
        const rows = tx.update(areasTable)
          .set({email: event.email})
          .where(eq(areasTable.id, event.id))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to mark area email updated for ${event.id} - unknown area`);
        }
        break;
      }
      case 'OwnerAdded': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to add owner, unknown member number: '${event.memberNumber}'`);
        }
        tx.insert(ownersTable)
          .values({
            userId: userId.value,
            areaId: event.areaId,
            ownershipRecordedAt: event.recordedAt,
            markedOwnerByActor: event.actor,
          })
          .run();
        break;
      }
      case 'OwnerRemoved': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to remove owner, unknown member number: '${event.memberNumber}'`);
        }
        tx.delete(ownersTable)
          .where(
            and(
              eq(ownersTable.userId, userId.value),
              eq(ownersTable.areaId, event.areaId)
            )
          )
          .run();
        const equipmentInArea = tx
            .select({equipmentId: equipmentTable.id})
            .from(equipmentTable)
            .where(eq(equipmentTable.areaId, event.areaId))
            .all()
            .map(({equipmentId}) => equipmentId);
        tx.delete(trainersTable)
          .where(
            and(
              inArray(trainersTable.equipmentId, equipmentInArea),
              eq(trainersTable.userId, userId.value)
            )
          )
          .run();
        break;
      }
      case 'EquipmentTrainingSheetRegistered': {
        const rows = tx.update(equipmentTable)
          .set({trainingSheetId: event.trainingSheetId})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to update training sheet for equipment '${event.equipmentId}' - unknown equipment`);
        }
        break;
      }
      case 'RevokeTrainedOnEquipment': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to revoke training, unknown member number: '${event.memberNumber}'`);
        }
        tx.delete(trainedMemberstable)
          .where(
            and(
              eq(trainedMemberstable.userId, userId.value),
              eq(trainedMemberstable.equipmentId, event.equipmentId)
            )
          )
          .run();
        break;
      }
      case 'MemberRejoinedWithNewNumber': {
        addMemberNumberToExisting(tx, event.oldMemberNumber, event.newMemberNumber);
        break;
      }
      case 'MemberRejoinedWithExistingNumber': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to process member rejoining with same member number, unknown member number: '${event.memberNumber}'`);
        }
        revokeSuperuser(tx, userId.value);
        break;
      }
      case 'EquipmentTrainingSheetRemoved': {
        const rows = tx.update(equipmentTable)
          .set({trainingSheetId: null})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to remove training sheet for equipment '${event.equipmentId}' - unknown equipment`);
        }
        break;;
      }
      case 'TrainingStatNotificationSent': {
        const userId = findUserIdByMemberNumber(tx)(event.toMemberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to update training state notification sent, unknown member number: '${event.toMemberNumber}'`);
        }
        tx.insert(trainingStatsNotificationTable)
          .values({
            lastEmailSent: event.recordedAt,
            userId: userId.value,
          })
          .onConflictDoUpdate({
            target: trainingStatsNotificationTable.userId,
            set: {
              lastEmailSent: event.recordedAt,
            },
            setWhere: sql`${trainingStatsNotificationTable.lastEmailSent} < ${event.recordedAt.getTime()}`,
          })
          .run()
        break;
      }
      case 'TroubleTicketCreated': {
        // Resolve the raw equipment string to a known equipment record; a miss leaves
        // equipmentId null (the "Unassigned" bucket). Idempotent: the unique rowHash /
        // primary key make re-projecting the same event a no-op.
        const equipmentId = event.submittedEquipment
          ? O.toNullable(resolveEquipmentByName(tx)(event.submittedEquipment))
          : null;
        tx.insert(troubleTicketsTable)
          .values({
            id: event.id,
            rowHash: event.rowHash,
            status: 'Todo',
            title: event.issue,
            submittedAt: event.submittedAt,
            submittedName: event.submittedName,
            submittedMemberNumber: event.submittedMemberNumber,
            submittedEmail: event.submittedEmail,
            submittedEquipment: event.submittedEquipment,
            equipmentId,
            responseJson: {
              otherEquipmentDetail: event.otherEquipmentDetail,
              status: event.status,
              attempting: event.attempting,
              issue: event.issue,
              steps: event.steps,
            },
          })
          .onConflictDoNothing()
          .run();
        break;
      }
      case 'TroubleTicketAssigned': {
        const userId = findUserIdByMemberNumber(tx)(event.trainerMemberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to assign trouble ticket, unknown member number: '${event.trainerMemberNumber}'`);
        }
        const ticket = tx
          .select({status: troubleTicketsTable.status})
          .from(troubleTicketsTable)
          .where(eq(troubleTicketsTable.id, event.ticketId))
          .get();
        if (ticket === undefined) {
          throw new InconsistentEventError(`Unable to assign unknown trouble ticket '${event.ticketId}'`);
        }
        tx.insert(troubleTicketAssigneesTable)
          .values({
            ticketId: event.ticketId,
            userId: userId.value,
            memberNumber: event.trainerMemberNumber,
            assignedAt: event.recordedAt,
          })
          .onConflictDoNothing({
            target: [
              troubleTicketAssigneesTable.ticketId,
              troubleTicketAssigneesTable.userId,
            ],
          })
          .run();
        // The first assignment on a Todo ticket moves it to In Progress.
        if (ticket.status === 'Todo') {
          tx.update(troubleTicketsTable)
            .set({status: 'In Progress'})
            .where(eq(troubleTicketsTable.id, event.ticketId))
            .run();
        }
        break;
      }
      case 'TroubleTicketResolved': {
        const rows = tx.update(troubleTicketsTable)
          .set({status: 'Resolved'})
          .where(eq(troubleTicketsTable.id, event.ticketId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to resolve unknown trouble ticket '${event.ticketId}'`);
        }
        break;
      }
      case 'TroubleTicketParked': {
        const rows = tx.update(troubleTicketsTable)
          .set({status: 'Parked'})
          .where(eq(troubleTicketsTable.id, event.ticketId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to park unknown trouble ticket '${event.ticketId}'`);
        }
        break;
      }
      case 'TroubleTicketNeedsHelp': {
        const rows = tx.update(troubleTicketsTable)
          .set({status: 'Needs Help'})
          .where(eq(troubleTicketsTable.id, event.ticketId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to flag unknown trouble ticket '${event.ticketId}' as needing help`);
        }
        // The trainer who flagged it is unassigned so another can pick it up.
        if (event.actor.tag === 'user') {
          const actorUserId = findUserIdByMemberNumber(tx)(event.actor.user.memberNumber);
          if (O.isSome(actorUserId)) {
            tx.delete(troubleTicketAssigneesTable)
              .where(
                and(
                  eq(troubleTicketAssigneesTable.ticketId, event.ticketId),
                  eq(troubleTicketAssigneesTable.userId, actorUserId.value)
                )
              )
              .run();
          }
        }
        break;
      }
      case 'TroubleTicketEquipmentSet': {
        const rows = tx.update(troubleTicketsTable)
          .set({equipmentId: event.equipmentId})
          .where(eq(troubleTicketsTable.id, event.ticketId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to set equipment for unknown trouble ticket '${event.ticketId}'`);
        }
        break;
      }
      case 'TroubleTicketTitleEdited': {
        const rows = tx.update(troubleTicketsTable)
          .set({title: event.title})
          .where(eq(troubleTicketsTable.id, event.ticketId))
          .run();
        if (rows.changes === 0) {
          throw new InconsistentEventError(`Unable to edit title of unknown trouble ticket '${event.ticketId}'`);
        }
        break;
      }
      case 'LinkingMemberNumberToAnAlreadyUsedEmailAttempted': {
        throw new InconsistentEventError(`Tried to link member number '${event.memberNumber}' to email '${event.email}' but it was already in use`);
      }
      default: {
        break;
      }
    }
  };

const _updateEventState = (tx: DatabaseTransaction, event: StoredDomainEvent) => tx.update(eventStateTable)
  .set({
    currentEventIndex: event.event_index
  })
  .run();


export function updateState (db: BetterSQLite3Database, logger: Logger, trackedEvent: true): (event: StoredDomainEvent) => void;
export function updateState (db: BetterSQLite3Database, logger: Logger, trackedEvent: false): (event: DomainEvent) => void;
export function updateState (db: BetterSQLite3Database, logger: Logger, trackedEvent: boolean) {
  // Update the state without updating the stored event state information
  // This should only be used for external information which isn't tracked within the main event stream.
  return (event: StoredDomainEvent) => {
    try {
      db.transaction(
        (tx: DatabaseTransaction) => {
          if (event.deletedAt === null) {
            _updateState(tx, event);
          }
          if (trackedEvent) {
            _updateEventState(tx, event);
          }
        }
      )
    } catch (err) {
      // Errors related to an inconsistent event stream should not normally be fatal.
      // Instead they are logged as failed events which admins can check and workout why the record
      // is inconsistent.
      // This is better than just crashing because in most cases the inconsistency only affects a small part of the record.
      let reason: string | null = null;
      if (err instanceof InconsistentEventError) {
        reason = err.message;
      } else if (err instanceof Error){
        const errType = err as Error & {code?: string};
        const code = errType.code ?? '';
        if (['SQLITE_CONSTRAINT_PRIMARYKEY', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(code)) {
          reason = code;
        }
      }

      if (reason) {
        logger.error(err, 'Failed to update state \'%s\' with event %o', reason, event);
        db.transaction((tx: DatabaseTransaction) => {
          tx.insert(failedEventsTable)
            .values({
              eventId: event.event_id,
              eventIndex: event.event_index,
              eventType: event.type,
              error: reason,
              payload: event,
            })
            .onConflictDoNothing()
            .run();
          if (trackedEvent) {
            _updateEventState(tx, event);
          }
        });        
        return;
      }
      throw err;
    }
  }
};
