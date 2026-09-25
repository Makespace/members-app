import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {mailboxArchivedMessagesTable} from '../state';

// Every archived message id at once. The mailbox page decides per
// conversation, over a window of a few hundred messages, so one set beats a
// query per row.
export const getArchivedMailboxMessageIds =
  (db: BetterSQLite3Database) => (): ReadonlySet<string> =>
    new Set(
      db
        .select({id: mailboxArchivedMessagesTable.gmailMessageId})
        .from(mailboxArchivedMessagesTable)
        .all()
        .map(row => row.id)
    );
