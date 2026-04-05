import {DomainEvent, StoredDomainEvent} from '../../types/domain-event';
import {EmailAddress} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {
  areasTable,
  equipmentTable,
  eventStateTable,
  memberEmailsTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
  trainingStatsNotificationTable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, ExtractTablesWithRelations, inArray, isNotNull, sql} from 'drizzle-orm';
import {isOwnerOfAreaContainingEquipment} from './area/helpers';
import {pipe} from 'fp-ts/lib/function';
import {MemberLinking} from './member-linking';
import {normaliseEmailAddress} from './normalise-email-address';
import { Logger } from 'pino';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';

type DatabaseTransaction = SQLiteTransaction<"sync", Database.RunResult, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;

const revokeSuperuser = (tx: DatabaseTransaction, memberNumber: number) =>
  tx
    .update(membersTable)
    .set({isSuperUser: false, superUserSince: null})
    .where(eq(membersTable.memberNumber, memberNumber))
    .run();

const setPrimaryEmailAddress = (
  tx: DatabaseTransaction,
  memberNumber: number,
  emailAddress: EmailAddress
) =>
  tx
    .update(membersTable)
    .set({
      primaryEmailAddress: emailAddress,
      gravatarHash: gravatarHashFromEmail(emailAddress),
    })
    .where(eq(membersTable.memberNumber, memberNumber))
    .run();

const findMemberEmail = (
  tx: DatabaseTransaction,
  memberNumber: number,
  emailAddress: EmailAddress
) =>
  O.fromNullable(
    tx
      .select()
      .from(memberEmailsTable)
      .where(
        and(
          eq(memberEmailsTable.memberNumber, memberNumber),
          eq(memberEmailsTable.emailAddress, emailAddress)
        )
      )
      .limit(1)
      .get()
  );

const insertMemberEmail = (
  tx: DatabaseTransaction,
  memberNumber: number,
  emailAddress: EmailAddress,
  addedAt: Date,
  verifiedAt: Date | null
) =>
  tx
    .insert(memberEmailsTable)
    .values({
      memberNumber,
      emailAddress,
      addedAt,
      verifiedAt: verifiedAt ?? undefined,
    })
    .run();

const _updateState =
  (tx: DatabaseTransaction, linking: MemberLinking, event: DomainEvent) => {
    switch (event.type) {
      case 'MemberNumberLinkedToEmail': {
        const normalisedEmailAddress = normaliseEmailAddress(event.email);
        linking.link([event.memberNumber]);
        const existingMember = O.fromNullable(
          tx
            .select()
            .from(membersTable)
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .limit(1)
            .get()
        );
        if (O.isNone(existingMember)) {
          tx.insert(membersTable)
            .values({
              memberNumber: event.memberNumber,
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
        }
        if (
          O.isNone(findMemberEmail(tx, event.memberNumber, normalisedEmailAddress))
        ) {
          insertMemberEmail(
            tx,
            event.memberNumber,
            normalisedEmailAddress,
            event.recordedAt,
            event.recordedAt
          );
        }
        setPrimaryEmailAddress(tx, event.memberNumber, normalisedEmailAddress);
        break;
      }
      case 'MemberEmailAdded': {
        const normalisedEmailAddress = normaliseEmailAddress(event.email);
        if (
          O.isNone(findMemberEmail(tx, event.memberNumber, normalisedEmailAddress))
        ) {
          insertMemberEmail(
            tx,
            event.memberNumber,
            normalisedEmailAddress,
            event.recordedAt,
            null
          );
        }
        break;
      }
      case 'MemberEmailVerified':
        tx.update(memberEmailsTable)
          .set({verifiedAt: event.recordedAt})
          .where(
            and(
              eq(memberEmailsTable.memberNumber, event.memberNumber),
              eq(
                memberEmailsTable.emailAddress,
                normaliseEmailAddress(event.email)
              )
            )
          )
          .run();
        break;
      case 'MemberPrimaryEmailChanged':
        setPrimaryEmailAddress(
          tx,
          event.memberNumber,
          normaliseEmailAddress(event.email)
        );
        break;
      case 'MemberEmailVerificationRequested':
        tx.update(memberEmailsTable)
          .set({
            verificationLastSent: event.recordedAt
          })
          .where(
            and(
              eq(memberEmailsTable.memberNumber, event.memberNumber),
              eq(memberEmailsTable.emailAddress, normaliseEmailAddress(event.email))
            )
          )
          .run();
        break;
      case 'MemberDetailsUpdated':
        if (event.name) {
          tx.update(membersTable)
            .set({name: O.some(event.name)})
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        if (event.formOfAddress) {
          tx.update(membersTable)
            .set({formOfAddress: O.some(event.formOfAddress)})
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        break;
      case 'SuperUserDeclared':
        tx.update(membersTable)
          .set({isSuperUser: true, superUserSince: event.recordedAt})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'SuperUserRevoked':
        revokeSuperuser(tx, event.memberNumber);
        break;
      case 'EquipmentAdded':
        tx.insert(equipmentTable)
          .values({id: event.id, name: event.name, areaId: event.areaId})
          .run();
        break;
      case 'TrainerAdded': {
        if (
          isOwnerOfAreaContainingEquipment(tx, linking)(
            event.equipmentId,
            event.memberNumber
          )
        ) {
          tx.insert(trainersTable)
            .values({
              memberNumber: event.memberNumber,
              equipmentId: event.equipmentId,
              since: event.recordedAt,
              markedTrainerByActor: event.actor,
            })
            .run();
        }
        break;
      }
      case 'MemberTrainedOnEquipment': {
        const existing = O.fromNullable(
          tx
            .select()
            .from(trainedMemberstable)
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.memberNumber, event.memberNumber)
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
        if (O.isSome(existing)) {
          tx.update(trainedMemberstable)
            .set({
              trainedAt: event.recordedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: event.legacyImport,
              markTrainedByActor: event.actor,
            })
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.memberNumber, event.memberNumber)
              )
            )
            .run();
        } else {
          tx.insert(trainedMemberstable)
            .values({
              memberNumber: event.memberNumber,
              equipmentId: event.equipmentId,
              trainedAt: event.recordedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: event.legacyImport,
              markTrainedByActor: event.actor,
            })
            .run();
        }
        break;
      }
      case 'MemberTrainedOnEquipmentBy': {
        const existing = O.fromNullable(
          tx
            .select()
            .from(trainedMemberstable)
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.memberNumber, event.memberNumber)
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
        if (O.isSome(existing)) {
          tx.update(trainedMemberstable)
            .set({
              trainedAt: event.trainedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: false,
              markTrainedByActor: event.actor,
            })
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.memberNumber, event.memberNumber)
              )
            )
            .run();
        } else {
          tx.insert(trainedMemberstable)
            .values({
              memberNumber: event.memberNumber,
              equipmentId: event.equipmentId,
              trainedAt: event.trainedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: false,
              markTrainedByActor: event.actor,
            })
            .run();
        }
        break;
      }
      case 'OwnerAgreementSigned':
        tx.update(membersTable)
          .set({agreementSigned: event.signedAt})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
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
            memberNumber: event.memberNumber,
            areaId: event.areaId,
            ownershipRecordedAt: event.recordedAt,
            markedOwnerByActor: event.actor,
          })
          .run();
        break;
      case 'OwnerRemoved': {
        tx.delete(ownersTable)
          .where(
            and(
              inArray(
                ownersTable.memberNumber,
                Array.from(linking.map(event.memberNumber))
              ),
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
              eq(trainersTable.memberNumber, event.memberNumber)
            )
          )
          .run();
        break;
      }
      case 'EquipmentTrainingSheetRegistered':
        tx.update(equipmentTable)
          .set({trainingSheetId: event.trainingSheetId})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        break;
      case 'RevokeTrainedOnEquipment':
        tx.delete(trainedMemberstable)
          .where(
            and(
              eq(trainedMemberstable.equipmentId, event.equipmentId),
              eq(trainedMemberstable.memberNumber, event.memberNumber)
            )
          )
          .run();
        break;
      case 'RecurlySubscriptionUpdated': {
        const status = event.hasActiveSubscription ? 'active' : 'inactive';
        const memberNumbers = tx
          .select({
            memberNumber: memberEmailsTable.memberNumber,
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
          .map(row => row.memberNumber);
        if (memberNumbers.length > 0) {
          tx.update(membersTable)
            .set({
              status,
            })
            .where(inArray(membersTable.memberNumber, memberNumbers))
            .run();
        }
        break;
      }
      case 'MemberRejoinedWithNewNumber': {
        linking.link([event.oldMemberNumber, event.newMemberNumber]);
        revokeSuperuser(tx, event.oldMemberNumber);
        revokeSuperuser(tx, event.newMemberNumber);
        break;
      }
      case 'MemberRejoinedWithExistingNumber': {
        revokeSuperuser(tx, event.memberNumber);
        break;
      }
      case 'EquipmentTrainingSheetRemoved': {
        tx.update(equipmentTable)
          .set({trainingSheetId: null})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        break;
      }
      case 'TrainingStatNotificationSent': {
        tx.insert(trainingStatsNotificationTable)
          .values({
            lastEmailSent: event.recordedAt,
            memberNumber: event.toMemberNumber,
          })
          .onConflictDoUpdate({
            target: trainingStatsNotificationTable.memberNumber,
            set: {
              lastEmailSent: event.recordedAt,
            },
            setWhere: sql`${trainingStatsNotificationTable.lastEmailSent} < ${event.recordedAt.getTime()}`,
          })
          .run();
        break;
      }
      default:
        break;
    }
  };

const _updateEventState = (tx: DatabaseTransaction, event: StoredDomainEvent) => tx.update(eventStateTable)
  .set({
    currentEventIndex: event.event_index
  })
  .run();


export function updateState (db: BetterSQLite3Database, linking: MemberLinking, logger: Logger, trackedEvent: true): (event: StoredDomainEvent) => void;
export function updateState (db: BetterSQLite3Database, linking: MemberLinking, logger: Logger, trackedEvent: false): (event: DomainEvent) => void;
export function updateState (db: BetterSQLite3Database, linking: MemberLinking, logger: Logger, trackedEvent: boolean) {
  // Update the state without updating the stored event state information
  // This should only be used for external information which isn't tracked within the main event stream.
  return (event: StoredDomainEvent) => {
    try {
      db.transaction(
        (tx: DatabaseTransaction) => {
          _updateState(tx, linking, event);
          if (trackedEvent) {
            _updateEventState(tx, event);
          }
        }
      )
    } catch (err) {
      const errType = err as Error;
      if ('code' in errType && ['SQLITE_CONSTRAINT_PRIMARYKEY', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(errType.code as string)) {
        logger.error(err, 'Failed to update state with event %o', event);
        return;
      }
      throw err;
    }
  }
};
