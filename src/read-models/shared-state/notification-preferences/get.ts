import {eq} from 'drizzle-orm';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {memberNotificationPreferencesTable} from '../state';

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
