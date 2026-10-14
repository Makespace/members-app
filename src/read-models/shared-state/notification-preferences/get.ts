import {and, eq} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {
  memberNotificationEmailsTable,
  memberDigestsTable,
  memberNotificationPreferencesTable,
} from '../state';

// What one member has said, scope by scope. Everything they have said nothing
// about is absent, which is what following the rule above means.
export const getNotificationPreferences =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): ReadonlyMap<string, string> =>
    new Map(
      db
        .select({
          scope: memberNotificationPreferencesTable.scope,
          preference: memberNotificationPreferencesTable.preference,
        })
        .from(memberNotificationPreferencesTable)
        .where(
          eq(memberNotificationPreferencesTable.memberNumber, memberNumber)
        )
        .all()
        .map(row => [row.scope, row.preference])
    );

// Everybody who has ever said anything about their notifications. Small - most
// members never open the page - and it is the set that has to be considered
// alongside the people a ticket already concerns, because somebody can ask to
// hear about an area they have nothing to do with.
export const getMembersWithNotificationPreferences =
  (db: BetterSQLite3Database) => (): ReadonlyArray<number> =>
    [
      ...new Set(
        db
          .select({
            memberNumber: memberNotificationPreferencesTable.memberNumber,
          })
          .from(memberNotificationPreferencesTable)
          .all()
          .map(row => row.memberNumber)
      ),
    ];

export type DigestWatermark = {
  sentAt: Date;
  upToEventIndex: number;
};

// When a member was last sent a summary of this kind. Absent until the first
// one goes out, which is deliberate: a member who has had nothing worth
// sending has no row, and their first summary covers only the period just
// gone rather than everything that ever happened.
export const getDigestWatermark =
  (db: BetterSQLite3Database) =>
  (memberNumber: number, cadence: string): O.Option<DigestWatermark> =>
    O.fromNullable(
      db
        .select({
          sentAt: memberDigestsTable.sentAt,
          upToEventIndex: memberDigestsTable.upToEventIndex,
        })
        .from(memberDigestsTable)
        .where(
          and(
            eq(memberDigestsTable.memberNumber, memberNumber),
            eq(memberDigestsTable.cadence, cadence)
          )
        )
        .get() ?? null
    );

// How many trouble ticket notifications somebody has been sent. Used only to
// decide whether an email still needs to explain what this is.
export const getNotificationEmailCount =
  (db: BetterSQLite3Database) =>
  (memberNumber: number): number =>
    db
      .select({sent: memberNotificationEmailsTable.sent})
      .from(memberNotificationEmailsTable)
      .where(eq(memberNotificationEmailsTable.memberNumber, memberNumber))
      .get()?.sent ?? 0;
