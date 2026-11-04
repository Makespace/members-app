import {sql} from 'drizzle-orm';
import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

// The upcoming trainings on the Makespace Meetup group, as Meetup last
// described them. A cache of something outside the app, so it lives with the
// other external state rather than in the event log: nothing here was decided
// in the app, and the whole table is replaced on each pull.
export const meetupTrainingTable = sqliteTable('meetup_trainings', {
  eventId: text('eventId').primaryKey(),
  title: text('title').notNull(),
  startsAt: integer('startsAt', {mode: 'timestamp_ms'}).notNull(),
  endsAt: integer('endsAt', {mode: 'timestamp_ms'}).notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  // Meetup's own count, which appears to include the host.
  going: integer('going').notNull(),
  // 0 when the event has no limit.
  maxTickets: integer('maxTickets').notNull(),
  rsvpsClosed: integer('rsvpsClosed', {mode: 'boolean'}).notNull(),
  fetchedAt: integer('fetchedAt', {mode: 'timestamp_ms'}).notNull(),
});

const createMeetupTrainingTable = sql`
  CREATE TABLE IF NOT EXISTS meetup_trainings (
    eventId TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    startsAt INTEGER NOT NULL,
    endsAt INTEGER NOT NULL,
    url TEXT NOT NULL,
    description TEXT NOT NULL,
    going INTEGER NOT NULL,
    maxTickets INTEGER NOT NULL,
    rsvpsClosed INTEGER NOT NULL,
    fetchedAt INTEGER NOT NULL
  );
`;

export const createTables = [createMeetupTrainingTable];
