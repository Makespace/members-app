import {DomainEvent, StoredDomainEvent} from '../../types/domain-event';
import {EmailAddress, UserId} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
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
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, inArray, isNotNull, isNull, sql} from 'drizzle-orm';
import {isOwnerOfAreaContainingEquipment} from './area/helpers';
import {pipe} from 'fp-ts/lib/function';
import {normaliseEmailAddress} from './normalise-email-address';
import {Logger} from 'pino';
import { DatabaseTransaction } from './database-transaction';
import { addMemberNumberToExisting } from './add-member-number-to-existing';
import { revokeSuperuser } from './revoke-super-user';
import { findUserIdByMemberNumber, findUserIdByEmail } from './member/get';
import { InconsistentEventError } from './inconsistent-event-error';
import { randomUUID } from 'node:crypto';
import { UUID } from 'io-ts-types';
import { insertMemberNumber } from './insert-member-number';
import { insertMemberEmail } from './insert-member-email';
import { setPrimaryEmailAddress } from './set-primary-email';
import { getEquipmentMinimal } from './equipment/get';

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

        const newUserId = randomUUID() as UUID;
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
            status: 'inactive',
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
          .run();
        break;
      }
      case 'MemberTrainedOnEquipment': {
        const userId = findUserIdByMemberNumber(tx)(event.memberNumber);
        if (O.isNone(userId)) {
          throw new InconsistentEventError(`Unable to mark member trained on equipment '${event.equipmentId}', unknown member number: '${event.memberNumber}'`);
        }
        if (O.isNone(getEquipmentMinimal(tx)(event.equipmentId))) {
          throw new InconsistentEventError(`Unable to mark member trained on equipment '${event.equipmentId}', unknown equipment`);
        }
        const existing = O.fromNullable(
          tx
            .select()
            .from(trainedMemberstable)
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.userId, userId.value)
              )
            )
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

        tx.insert(trainedMemberstable)
          .values({
            userId: userId.value,
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
        const existing = O.fromNullable(
          tx
            .select()
            .from(trainedMemberstable)
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.userId, userId.value)
              )
            )
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
        tx.insert(trainedMemberstable)
          .values({
            userId: userId.value,
            equipmentId: event.equipmentId,
            trainedAt: event.trainedAt,
            trainedByMemberNumber: event.trainedByMemberNumber,
            legacyImport: false,
            markTrainedByActor: event.actor,
          })
          .run();
        break;
      }
      case 'OwnerAgreementSigned':
        withUserId(tx, event.memberNumber, userId =>
          tx.update(membersTable)
            .set({agreementSigned: event.signedAt})
            .where(eq(membersTable.userId, userId))
            .run()
        );
        break;
      case 'AreaCreated':
        tx.insert(areasTable).values({id: event.id, name: event.name}).run();
        break;
      case 'AreaRemoved':
        tx.delete(areasTable).where(eq(areasTable.id, event.id)).run();
        break;
      case 'AreaEmailUpdated':
        tx.update(areasTable)
          .set({email: event.email})
          .where(eq(areasTable.id, event.id))
          .run();
        break;
      case 'OwnerAdded':
        tx.insert(ownersTable)
          .values({
            userId: pipe(
              findUserId(tx, event.memberNumber),
              O.getOrElse(() => userIdFromMemberNumber(event.memberNumber))
            ),
            areaId: event.areaId,
            ownershipRecordedAt: event.recordedAt,
            markedOwnerByActor: event.actor,
          })
          .run();
        break;
      case 'OwnerRemoved':
        withUserId(tx, event.memberNumber, userId => {
          tx.delete(ownersTable)
            .where(
              and(
                eq(ownersTable.userId, userId),
                eq(ownersTable.areaId, event.areaId)
              )
            )
            .run();
          const equipmentInArea = pipe(
            tx
              .select({equipmentId: equipmentTable.id})
              .from(equipmentTable)
              .where(eq(equipmentTable.areaId, event.areaId))
              .all(),
            RA.map(({equipmentId}) => equipmentId)
          );
          tx.delete(trainersTable)
            .where(
              and(
                inArray(trainersTable.equipmentId, [...equipmentInArea]),
                eq(trainersTable.userId, userId)
              )
            )
            .run();
        });
        break;
      case 'EquipmentTrainingSheetRegistered':
        tx.update(equipmentTable)
          .set({trainingSheetId: event.trainingSheetId})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        break;
      case 'RevokeTrainedOnEquipment':
        tx.delete(trainedMemberstable)
          .where(
            trainedMemberWhere(
              findUserId(tx, event.memberNumber),
              event.memberNumber,
              event.equipmentId
            )
          )
          .run();
        break;
      case 'RecurlySubscriptionUpdated': {
        const status = event.hasActiveSubscription ? 'active' : 'inactive';
        const userIds = tx
          .select({
            userId: memberEmailsTable.userId,
          })
          .from(memberEmailsTable)
          .where(
            and(
              eq(
                memberEmailsTable.emailAddress,
                normaliseEmailAddress(event.email)
              ),
              isNotNull(memberEmailsTable.verifiedAt)
            )
          )
          .all()
          .map(row => row.userId);
        if (userIds.length > 0) {
          tx.update(membersTable)
            .set({status})
            .where(inArray(membersTable.userId, userIds))
            .run();
        }
        break;
      }
      case 'MemberRejoinedWithNewNumber':
        addMemberNumberToExisting(tx, event.oldMemberNumber, event.newMemberNumber);
        break;
      case 'MemberRejoinedWithExistingNumber':
        revokeSuperuser(tx, event.memberNumber);
        break;
      case 'EquipmentTrainingSheetRemoved': {
        tx.update(equipmentTable)
          .set({trainingSheetId: null})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        break;
      }
      case 'TrainingStatNotificationSent':
        withUserId(tx, event.toMemberNumber, userId =>
          tx.insert(trainingStatsNotificationTable)
            .values({
              lastEmailSent: event.recordedAt,
              userId,
            })
            .onConflictDoUpdate({
              target: trainingStatsNotificationTable.userId,
              set: {
                lastEmailSent: event.recordedAt,
              },
              setWhere: sql`${trainingStatsNotificationTable.lastEmailSent} < ${event.recordedAt.getTime()}`,
            })
            .run()
        );
        break;
      default:
        break;
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
          _updateState(tx, event);
          if (trackedEvent) {
            _updateEventState(tx, event);
          }
        }
      )
    } catch (err) {
      const errType = err as Error & {code?: string};
      if (
        err instanceof InconsistentEventError
        || ['SQLITE_CONSTRAINT_PRIMARYKEY', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(
          errType.code ?? ''
        )
      ) {
        logger.error(err, 'Failed to update state with event %o', event);
        db.transaction((tx: DatabaseTransaction) => {
          tx.insert(failedEventsTable)
            .values({
              error: errType.code as string,
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
