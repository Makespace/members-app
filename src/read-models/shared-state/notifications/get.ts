import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {desc, eq, inArray} from 'drizzle-orm';
import {UUID} from 'io-ts-types';
import {
  notificationAreaTargetsTable,
  notificationDismissalsTable,
  notificationsTable,
} from '../state';
import {Member} from '../return-types';

export type Notification = {
  id: UUID;
  title: string;
  message: string;
  bannerType: 'action' | 'event' | 'info';
  linkUrl: string | null;
  linkLabel: string | null;
  dismissable: boolean;
  expiresAt: Date | null;
  targetAllOwners: boolean;
  targetAreaIds: ReadonlyArray<UUID>;
  emailMarkdown: string | null;
  emailSent: boolean;
  revoked: boolean;
  createdAt: Date;
};

type Row = typeof notificationsTable.$inferSelect;

const withTargets =
  (db: BetterSQLite3Database) =>
  (rows: ReadonlyArray<Row>): ReadonlyArray<Notification> => {
    if (rows.length === 0) {
      return [];
    }
    const targets = db
      .select()
      .from(notificationAreaTargetsTable)
      .where(
        inArray(
          notificationAreaTargetsTable.notificationId,
          rows.map(row => row.id)
        )
      )
      .all();
    const byNotification = new Map<string, UUID[]>();
    for (const target of targets) {
      const bucket = byNotification.get(target.notificationId) ?? [];
      bucket.push(target.areaId);
      byNotification.set(target.notificationId, bucket);
    }
    return rows.map(row => ({
      ...row,
      expiresAt: row.expiresAt ?? null,
      linkUrl: row.linkUrl ?? null,
      linkLabel: row.linkLabel ?? null,
      emailMarkdown: row.emailMarkdown ?? null,
      targetAreaIds: byNotification.get(row.id) ?? [],
    }));
  };

// Every notification, newest first - the admin management list.
export const getAllNotifications =
  (db: BetterSQLite3Database) => (): ReadonlyArray<Notification> =>
    withTargets(db)(
      db
        .select()
        .from(notificationsTable)
        .orderBy(desc(notificationsTable.createdAt))
        .all()
    );

export const getNotificationById =
  (db: BetterSQLite3Database) =>
  (id: UUID): Notification | undefined =>
    withTargets(db)(
      db.select().from(notificationsTable).where(eq(notificationsTable.id, id)).all()
    )[0];

// Whether a notification targets the given member: all-owner notifications
// reach every owner; area-targeted ones reach owners of any listed area.
export const notificationTargets = (
  notification: Notification,
  member: Pick<Member, 'ownerOf'>
): boolean => {
  if (notification.targetAllOwners) {
    return member.ownerOf.length > 0;
  }
  return member.ownerOf.some(area =>
    notification.targetAreaIds.includes(area.id as UUID)
  );
};

// The live notifications the given member should see right now: targeted at
// them, not revoked, not expired, not dismissed by them. Oldest first so the
// banner stack reads chronologically.
export const getNotificationsForMember =
  (db: BetterSQLite3Database) =>
  (member: Member, now: Date): ReadonlyArray<Notification> => {
    const dismissed = new Set(
      db
        .select({notificationId: notificationDismissalsTable.notificationId})
        .from(notificationDismissalsTable)
        .where(eq(notificationDismissalsTable.memberNumber, member.memberNumber))
        .all()
        .map(row => row.notificationId)
    );
    return getAllNotifications(db)()
      .filter(
        notification =>
          !notification.revoked &&
          (notification.expiresAt === null || notification.expiresAt > now) &&
          !dismissed.has(notification.id) &&
          notificationTargets(notification, member)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };
