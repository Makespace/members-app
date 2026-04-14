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
  memberNumbersTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
  trainingStatsNotificationTable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, ExtractTablesWithRelations, inArray, isNotNull, isNull, sql} from 'drizzle-orm';
import {isOwnerOfAreaContainingEquipment} from './area/helpers';
import {pipe} from 'fp-ts/lib/function';
import {normaliseEmailAddress} from './normalise-email-address';
import {Logger} from 'pino';
import {SQLiteTransaction} from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';

type DatabaseTransaction = SQLiteTransaction<"sync", Database.RunResult, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;

const findUserId = (tx: DatabaseTransaction, memberNumber: number): O.Option<UserId> =>
  pipe(
    tx
      .select({userId: memberNumbersTable.userId})
      .from(memberNumbersTable)
      .where(eq(memberNumbersTable.memberNumber, memberNumber))
      .get(),
    row => O.fromNullable(row?.userId)
  );

const withUserId = (
  tx: DatabaseTransaction,
  memberNumber: number,
  f: (userId: UserId) => void
) =>
  pipe(
    findUserId(tx, memberNumber),
    O.match(() => undefined, f)
  );

const insertMemberNumber = (
  tx: DatabaseTransaction,
  memberNumber: number,
  userId: UserId
) => {
  tx
    .insert(memberNumbersTable)
    .values({memberNumber, userId})
    .onConflictDoUpdate({
      target: memberNumbersTable.memberNumber,
      set: {userId},
    })
    .run();
  tx.update(trainedMemberstable)
    .set({userId})
    .where(
      and(
        eq(trainedMemberstable.memberNumber, memberNumber),
        isNull(trainedMemberstable.userId)
      )
    )
    .run();
};

const trainedMemberWhere = (
  userId: O.Option<UserId>,
  memberNumber: number,
  equipmentId: string
) =>
  and(
    eq(trainedMemberstable.equipmentId, equipmentId),
    O.isSome(userId)
      ? eq(trainedMemberstable.userId, userId.value)
      : and(
          eq(trainedMemberstable.memberNumber, memberNumber),
          isNull(trainedMemberstable.userId)
        )
  );

const upsertTrainedMember = (
  tx: DatabaseTransaction,
  input: {
    memberNumber: number;
    equipmentId: string;
    trainedAt: Date;
    trainedByMemberNumber: number | null;
    legacyImport: boolean;
    actor: DomainEvent['actor'];
  }
) => {
  const userId = findUserId(tx, input.memberNumber);
  const where = trainedMemberWhere(
    userId,
    input.memberNumber,
    input.equipmentId
  );
  const existing = O.fromNullable(
    tx.select().from(trainedMemberstable).where(where).limit(1).get()
  );
  if (
    O.isSome(existing) &&
    existing.value.trainedAt.getTime() - 1000 < input.trainedAt.getTime()
  ) {
    return;
  }
  if (O.isSome(existing)) {
    tx.update(trainedMemberstable)
      .set({
        trainedAt: input.trainedAt,
        trainedByMemberNumber: input.trainedByMemberNumber,
        legacyImport: input.legacyImport,
        markTrainedByActor: input.actor,
      })
      .where(where)
      .run();
  } else {
    tx.insert(trainedMemberstable)
      .values({
        userId: O.toNullable(userId),
        memberNumber: input.memberNumber,
        equipmentId: input.equipmentId,
        trainedAt: input.trainedAt,
        trainedByMemberNumber: input.trainedByMemberNumber,
        legacyImport: input.legacyImport,
        markTrainedByActor: input.actor,
      })
      .run();
  }
};

const revokeSuperuserByUserId = (tx: DatabaseTransaction, userId: UserId) =>
  tx
    .update(membersTable)
    .set({isSuperUser: false, superUserSince: null})
    .where(eq(membersTable.userId, userId))
    .run();

const revokeSuperuser = (tx: DatabaseTransaction, memberNumber: number) =>
  withUserId(tx, memberNumber, userId => revokeSuperuserByUserId(tx, userId));

const setPrimaryEmailAddress = (
  tx: DatabaseTransaction,
  memberNumber: number,
  emailAddress: EmailAddress
) =>
  withUserId(tx, memberNumber, userId =>
    tx
      .update(membersTable)
      .set({
        primaryEmailAddress: emailAddress,
        gravatarHash: gravatarHashFromEmail(emailAddress),
      })
      .where(eq(membersTable.userId, userId))
      .run()
  );

const findMemberEmail = (
  tx: DatabaseTransaction,
  userId: UserId,
  emailAddress: EmailAddress
) =>
  O.fromNullable(
    tx
      .select()
      .from(memberEmailsTable)
      .where(
        and(
          eq(memberEmailsTable.userId, userId),
          eq(memberEmailsTable.emailAddress, emailAddress)
        )
      )
      .limit(1)
      .get()
  );

const insertMemberEmail = (
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
    .run();

const earliest = (a: Date | null, b: Date | null) => {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a < b ? a : b;
};

const latest = (a: Date, b: Date) => (a > b ? a : b);

const mergeTrainingStatNotification = (
  tx: DatabaseTransaction,
  sourceUserId: UserId,
  targetUserId: UserId
) => {
  const source = tx
    .select()
    .from(trainingStatsNotificationTable)
    .where(eq(trainingStatsNotificationTable.userId, sourceUserId))
    .get();
  const target = tx
    .select()
    .from(trainingStatsNotificationTable)
    .where(eq(trainingStatsNotificationTable.userId, targetUserId))
    .get();

  if (source && target) {
    const sourceLastSent = source.lastEmailSent?.getTime() ?? 0;
    const targetLastSent = target.lastEmailSent?.getTime() ?? 0;
    if (sourceLastSent > targetLastSent) {
      tx.update(trainingStatsNotificationTable)
        .set({lastEmailSent: source.lastEmailSent})
        .where(eq(trainingStatsNotificationTable.userId, targetUserId))
        .run();
    }
    tx.delete(trainingStatsNotificationTable)
      .where(eq(trainingStatsNotificationTable.userId, sourceUserId))
      .run();
  } else if (source) {
    tx.update(trainingStatsNotificationTable)
      .set({userId: targetUserId})
      .where(eq(trainingStatsNotificationTable.userId, sourceUserId))
      .run();
  }
};

const mergeUsers = (
  tx: DatabaseTransaction,
  sourceUserId: UserId,
  targetUserId: UserId
) => {
  if (sourceUserId === targetUserId) {
    return;
  }

  const source = tx
    .select()
    .from(membersTable)
    .where(eq(membersTable.userId, sourceUserId))
    .get();
  const target = tx
    .select()
    .from(membersTable)
    .where(eq(membersTable.userId, targetUserId))
    .get();

  if (!source || !target) {
    return;
  }

  tx.update(membersTable)
    .set({
      isSuperUser: source.isSuperUser || target.isSuperUser,
      superUserSince: earliest(source.superUserSince, target.superUserSince),
      joined: latest(source.joined, target.joined),
    })
    .where(eq(membersTable.userId, targetUserId))
    .run();

  tx.update(memberEmailsTable)
    .set({userId: targetUserId})
    .where(eq(memberEmailsTable.userId, sourceUserId))
    .run();
  tx.update(memberNumbersTable)
    .set({userId: targetUserId})
    .where(eq(memberNumbersTable.userId, sourceUserId))
    .run();
  tx.update(ownersTable)
    .set({userId: targetUserId})
    .where(eq(ownersTable.userId, sourceUserId))
    .run();
  tx.update(trainersTable)
    .set({userId: targetUserId})
    .where(eq(trainersTable.userId, sourceUserId))
    .run();
  tx.update(trainedMemberstable)
    .set({userId: targetUserId})
    .where(eq(trainedMemberstable.userId, sourceUserId))
    .run();
  mergeTrainingStatNotification(tx, sourceUserId, targetUserId);

  tx.delete(membersTable)
    .where(eq(membersTable.userId, sourceUserId))
    .run();
};

const linkMemberNumbers = (
  tx: DatabaseTransaction,
  oldMemberNumber: number,
  newMemberNumber: number
) => {
  const oldUserId = findUserId(tx, oldMemberNumber);
  const newUserId = findUserId(tx, newMemberNumber);

  if (O.isSome(oldUserId) && O.isSome(newUserId)) {
    mergeUsers(tx, oldUserId.value, newUserId.value);
    insertMemberNumber(tx, oldMemberNumber, newUserId.value);
    insertMemberNumber(tx, newMemberNumber, newUserId.value);
    revokeSuperuserByUserId(tx, newUserId.value);
    return;
  }
  if (O.isSome(oldUserId)) {
    insertMemberNumber(tx, newMemberNumber, oldUserId.value);
    revokeSuperuserByUserId(tx, oldUserId.value);
    return;
  }
  if (O.isSome(newUserId)) {
    insertMemberNumber(tx, oldMemberNumber, newUserId.value);
    revokeSuperuserByUserId(tx, newUserId.value);
  }
};

const _updateState =
  (tx: DatabaseTransaction, event: DomainEvent) => {
    switch (event.type) {
      case 'MemberNumberLinkedToEmail': {
        const normalisedEmailAddress = normaliseEmailAddress(event.email);
        const userId = pipe(
          findUserId(tx, event.memberNumber),
          O.getOrElse(() => userIdFromMemberNumber(event.memberNumber))
        );
        const existingMember = O.fromNullable(
          tx
            .select()
            .from(membersTable)
            .where(eq(membersTable.userId, userId))
            .limit(1)
            .get()
        );
        if (O.isNone(existingMember)) {
          tx.insert(membersTable)
            .values({
              userId,
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
        insertMemberNumber(tx, event.memberNumber, userId);
        if (O.isNone(findMemberEmail(tx, userId, normalisedEmailAddress))) {
          insertMemberEmail(
            tx,
            userId,
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
        withUserId(tx, event.memberNumber, userId => {
          if (O.isNone(findMemberEmail(tx, userId, normalisedEmailAddress))) {
            insertMemberEmail(
              tx,
              userId,
              normalisedEmailAddress,
              event.recordedAt,
              null
            );
          }
        });
        break;
      }
      case 'MemberEmailVerified':
        withUserId(tx, event.memberNumber, userId =>
          tx.update(memberEmailsTable)
            .set({verifiedAt: event.recordedAt})
            .where(
              and(
                eq(memberEmailsTable.userId, userId),
                eq(
                  memberEmailsTable.emailAddress,
                  normaliseEmailAddress(event.email)
                )
              )
            )
            .run()
        );
        break;
      case 'MemberPrimaryEmailChanged':
        setPrimaryEmailAddress(
          tx,
          event.memberNumber,
          normaliseEmailAddress(event.email)
        );
        break;
      case 'MemberEmailVerificationRequested':
        withUserId(tx, event.memberNumber, userId =>
          tx.update(memberEmailsTable)
            .set({
              verificationLastSent: event.recordedAt
            })
            .where(
              and(
                eq(memberEmailsTable.userId, userId),
                eq(memberEmailsTable.emailAddress, normaliseEmailAddress(event.email))
              )
            )
            .run()
        );
        break;
      case 'MemberDetailsUpdated':
        withUserId(tx, event.memberNumber, userId => {
          if (event.name) {
            tx.update(membersTable)
              .set({name: O.some(event.name)})
              .where(eq(membersTable.userId, userId))
              .run();
          }
          if (event.formOfAddress) {
            tx.update(membersTable)
              .set({formOfAddress: O.some(event.formOfAddress)})
              .where(eq(membersTable.userId, userId))
              .run();
          }
        });
        break;
      case 'SuperUserDeclared':
        withUserId(tx, event.memberNumber, userId =>
          tx.update(membersTable)
            .set({isSuperUser: true, superUserSince: event.recordedAt})
            .where(eq(membersTable.userId, userId))
            .run()
        );
        break;
      case 'SuperUserRevoked':
        revokeSuperuser(tx, event.memberNumber);
        break;
      case 'EquipmentAdded':
        tx.insert(equipmentTable)
          .values({id: event.id, name: event.name, areaId: event.areaId})
          .run();
        break;
      case 'TrainerAdded':
        withUserId(tx, event.memberNumber, userId => {
          if (isOwnerOfAreaContainingEquipment(tx)(event.equipmentId, event.memberNumber)) {
            tx.insert(trainersTable)
              .values({
                userId,
                equipmentId: event.equipmentId,
                since: event.recordedAt,
                markedTrainerByActor: event.actor,
              })
              .run();
          }
        });
        break;
      case 'MemberTrainedOnEquipment':
        upsertTrainedMember(tx, {
          memberNumber: event.memberNumber,
          equipmentId: event.equipmentId,
          trainedAt: event.recordedAt,
          trainedByMemberNumber: event.trainedByMemberNumber,
          legacyImport: event.legacyImport,
          actor: event.actor,
        });
        break;
      case 'MemberTrainedOnEquipmentBy':
        upsertTrainedMember(tx, {
          memberNumber: event.memberNumber,
          equipmentId: event.equipmentId,
          trainedAt: event.trainedAt,
          trainedByMemberNumber: event.trainedByMemberNumber,
          legacyImport: false,
          actor: event.actor,
        });
        break;
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
        linkMemberNumbers(tx, event.oldMemberNumber, event.newMemberNumber);
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
        ['SQLITE_CONSTRAINT_PRIMARYKEY', 'SQLITE_CONSTRAINT_FOREIGNKEY'].includes(
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
