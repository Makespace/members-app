import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {mailboxArchivedMessagesTable} from '../state';
import {MailboxArchiveReason} from '../../../types/mailbox-archive-reason';

// Every archived message id at once, with why. The mailbox page decides per
// conversation, over a window of a few hundred messages, so one map beats a
// query per row.
export const getArchivedMailboxMessages =
  (db: BetterSQLite3Database) => (): ReadonlyMap<string, MailboxArchiveReason> =>
    new Map(
      db
        .select({
          id: mailboxArchivedMessagesTable.gmailMessageId,
          reason: mailboxArchivedMessagesTable.reason,
        })
        .from(mailboxArchivedMessagesTable)
        .all()
        .map(row => [row.id, row.reason])
    );
