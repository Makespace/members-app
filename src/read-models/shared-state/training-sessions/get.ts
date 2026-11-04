import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, asc, desc, eq, gt, isNull} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {
  trainingSessionAttendeesTable,
  trainingSessionNotificationsTable,
  trainingSessionsTable,
} from '../state';

export type TrainingSession = {
  id: UUID;
  equipmentId: UUID;
  trainerMemberNumber: number;
  startsAt: Date;
  endsAt: Date;
  spaces: number;
  description: string;
  signUpsCloseAt: Date;
  cancelled: O.Option<{at: Date; reason: string}>;
  // Earliest booked first.
  attendees: ReadonlyArray<number>;
};

const toSession =
  (db: BetterSQLite3Database) =>
  (
    row: typeof trainingSessionsTable.$inferSelect
  ): TrainingSession => ({
    id: row.id,
    equipmentId: row.equipmentId,
    trainerMemberNumber: row.trainerMemberNumber,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    spaces: row.spaces,
    description: row.description,
    signUpsCloseAt: row.signUpsCloseAt,
    cancelled:
      row.cancelledAt === null
        ? O.none
        : O.some({at: row.cancelledAt, reason: row.cancelReason ?? ''}),
    attendees: db
      .select({memberNumber: trainingSessionAttendeesTable.memberNumber})
      .from(trainingSessionAttendeesTable)
      .where(eq(trainingSessionAttendeesTable.sessionId, row.id))
      .orderBy(asc(trainingSessionAttendeesTable.bookedAt))
      .all()
      .map(attendee => attendee.memberNumber),
  });

export const getTrainingSession =
  (db: BetterSQLite3Database) =>
  (sessionId: UUID): O.Option<TrainingSession> =>
    pipe(
      db
        .select()
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.id, sessionId))
        .get(),
      O.fromNullable,
      O.map(toSession(db))
    );

// Every session on the machine, past and future, cancelled or not, latest
// first.
export const getAllTrainingSessionsForEquipment =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID): ReadonlyArray<TrainingSession> =>
    db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.equipmentId, equipmentId))
      .orderBy(desc(trainingSessionsTable.startsAt))
      .all()
      .map(toSession(db));

// Everyone who has ever arranged a session on the machine through the app,
// past sessions included.
export const getMemberNumbersWhoHaveArrangedTraining =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID): ReadonlyArray<number> =>
    db
      .selectDistinct({
        memberNumber: trainingSessionsTable.trainerMemberNumber,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.equipmentId, equipmentId))
      .all()
      .map(row => row.memberNumber);

// Sessions that are going ahead and have not finished yet, soonest first. One
// already under way still counts: somebody looking at the page mid-session
// should see it.
export const getUpcomingTrainingSessionsForEquipment =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID, now: Date): ReadonlyArray<TrainingSession> =>
    db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.equipmentId, equipmentId),
          gt(trainingSessionsTable.endsAt, now),
          isNull(trainingSessionsTable.cancelledAt)
        )
      )
      .orderBy(asc(trainingSessionsTable.startsAt))
      .all()
      .map(toSession(db));

// The same, on every machine at once.
export const getAllUpcomingTrainingSessions =
  (db: BetterSQLite3Database) =>
  (now: Date): ReadonlyArray<TrainingSession> =>
    db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          gt(trainingSessionsTable.endsAt, now),
          isNull(trainingSessionsTable.cancelledAt)
        )
      )
      .orderBy(asc(trainingSessionsTable.startsAt))
      .all()
      .map(toSession(db));

export const hasNotifiedForTrainingSessionEvent =
  (db: BetterSQLite3Database) =>
  (eventIndex: number): boolean =>
    db
      .select({index: trainingSessionNotificationsTable.notifiedEventIndex})
      .from(trainingSessionNotificationsTable)
      .where(
        eq(trainingSessionNotificationsTable.notifiedEventIndex, eventIndex)
      )
      .get() !== undefined;
