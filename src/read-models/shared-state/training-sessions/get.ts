import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, asc, eq, gt} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {trainingSessionAttendeesTable, trainingSessionsTable} from '../state';

export type TrainingSession = {
  id: UUID;
  equipmentId: UUID;
  trainerMemberNumber: number;
  startsAt: Date;
  endsAt: Date;
  spaces: number;
  attendees: ReadonlyArray<number>;
};

const withAttendees =
  (db: BetterSQLite3Database) =>
  (session: Omit<TrainingSession, 'attendees'>): TrainingSession => ({
    ...session,
    attendees: db
      .select({memberNumber: trainingSessionAttendeesTable.memberNumber})
      .from(trainingSessionAttendeesTable)
      .where(eq(trainingSessionAttendeesTable.sessionId, session.id))
      .all()
      .map(row => row.memberNumber),
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
      O.map(withAttendees(db))
    );

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

// Sessions that have not finished yet, soonest first. One already under way
// still counts: somebody looking at the page mid-session should see it.
export const getUpcomingTrainingSessionsForEquipment =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID, now: Date): ReadonlyArray<TrainingSession> =>
    db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.equipmentId, equipmentId),
          gt(trainingSessionsTable.endsAt, now)
        )
      )
      .orderBy(asc(trainingSessionsTable.startsAt))
      .all()
      .map(withAttendees(db));
