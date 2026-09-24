import {Logger} from 'pino';
import {and, eq, isNull} from 'drizzle-orm';
import {auth as gmailAuth, gmail} from '@googleapis/gmail';
import {ExternalStateDB} from '../external-state-db';
import {
  gmailMessageTable,
  gmailSyncMetadataTable,
} from './gmail-message-table';
import {
  GmailApiMessage,
  parseGmailMessage,
  ParsedGmailMessage,
} from './parse-gmail-message';
import {withGoogleRateLimitRetry} from '../google/google-rate-limit-retry';

// Thin, injectable slice of the Gmail API - tests provide a fake. All
// methods act on the impersonated mailbox ('me' after subject impersonation).
export type GmailClient = {
  getProfile: () => Promise<{historyId?: string | null}>;
  listMessageIds: (
    query: string,
    pageToken?: string
  ) => Promise<{ids: string[]; nextPageToken?: string | null}>;
  getMessage: (id: string) => Promise<GmailApiMessage>;
  // Message ids added since startHistoryId. Throws {code: 404} when the
  // cursor has expired and a full re-list is required.
  listHistoryMessageIds: (
    startHistoryId: string
  ) => Promise<{ids: string[]; historyId?: string | null}>;
};

type GmailClientFactory = (mailbox: string) => GmailClient;

// The real factory. Two supported credentials, tried in this order:
// 1. An "authorized user" OAuth token minted for the mailbox account itself
//    (client id/secret + refresh token) - the narrowest option, touching
//    exactly one mailbox. Preferred when configured.
// 2. The sheet-sync service-account key with gmail.readonly domain-wide
//    delegation, impersonating the mailbox (see docs/gmail-import.md).
export const createGmailClientFactory =
  (
    serviceAccountKeyJson: string,
    authorizedUserJson: string
  ): GmailClientFactory =>
  mailbox => {
    // The gmail package's own auth class - avoids the version clash between
    // the app's top-level google-auth-library and the one googleapis-common
    // bundles. GoogleAuth accepts both credential shapes; only the
    // service-account path needs the impersonation subject.
    const auth = new gmailAuth.GoogleAuth(
      authorizedUserJson !== ''
        ? {
            // Google issues both credential files and validates them.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            credentials: JSON.parse(authorizedUserJson),
            clientOptions: {
              transporterOptions: {fetchImplementation: fetch},
            },
          }
        : {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            credentials: JSON.parse(serviceAccountKeyJson),
            clientOptions: {
              subject: mailbox,
              transporterOptions: {fetchImplementation: fetch},
            },
            scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
          }
    );
    const api = gmail({version: 'v1', auth});
    return {
      getProfile: async () =>
        (await api.users.getProfile({userId: 'me'})).data,
      listMessageIds: async (query, pageToken) => {
        const response = await api.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          q: query === '' ? undefined : query,
          maxResults: 100,
          pageToken,
        });
        return {
          ids: (response.data.messages ?? [])
            .map(message => message.id)
            .filter((id): id is string => typeof id === 'string'),
          nextPageToken: response.data.nextPageToken,
        };
      },
      getMessage: async id =>
        (await api.users.messages.get({userId: 'me', id, format: 'full'}))
          .data as GmailApiMessage,
      listHistoryMessageIds: async startHistoryId => {
        const ids = new Set<string>();
        let pageToken: string | undefined;
        let historyId: string | null | undefined;
        do {
          const response = await api.users.history.list({
            userId: 'me',
            startHistoryId,
            historyTypes: ['messageAdded'],
            labelId: 'INBOX',
            pageToken,
          });
          historyId = response.data.historyId ?? historyId;
          for (const entry of response.data.history ?? []) {
            for (const added of entry.messagesAdded ?? []) {
              if (added.message?.id) {
                ids.add(added.message.id);
              }
            }
          }
          pageToken = response.data.nextPageToken ?? undefined;
        } while (pageToken);
        return {ids: [...ids], historyId};
      },
    };
  };

// When the interesting address is a group, the import authenticates as a
// member account whose inbox also holds unrelated mail - only cache messages
// addressed to the group. The bootstrap listing filters server-side too, but
// history.list cannot, so this covers the incremental path.
const addressedToGroup = (
  filterToAddress: string,
  parsed: ParsedGmailMessage
): boolean => {
  const needle = filterToAddress.toLowerCase();
  return [parsed.deliveredTo, parsed.toAddresses, parsed.ccAddresses].some(
    header => header !== null && header.toLowerCase().includes(needle)
  );
};

// Replies are the reason this is not just a header check: people reply to
// each other, so a reply to a group thread usually carries none of the
// group's addresses. A message therefore counts as in scope when it is
// addressed to the group OR continues a thread we have already cached.
const isInScope = async (
  extDB: ExternalStateDB,
  filterToAddress: string,
  parsed: ParsedGmailMessage
): Promise<boolean> => {
  if (filterToAddress === '') {
    return true;
  }
  if (addressedToGroup(filterToAddress, parsed)) {
    return true;
  }
  const known = await extDB
    .select({id: gmailMessageTable.gmail_message_id})
    .from(gmailMessageTable)
    .where(eq(gmailMessageTable.gmail_thread_id, parsed.gmailThreadId))
    .limit(1);
  return known.length > 0;
};

const upsertMessage = async (
  extDB: ExternalStateDB,
  mailbox: string,
  parsed: ParsedGmailMessage
): Promise<void> => {
  const row = {
    gmail_message_id: parsed.gmailMessageId,
    gmail_thread_id: parsed.gmailThreadId,
    mailbox,
    rfc822_message_id: parsed.rfc822MessageId,
    from_address: parsed.fromAddress,
    to_addresses: parsed.toAddresses,
    subject: parsed.subject,
    received_at: parsed.receivedAt,
    snippet: parsed.snippet,
    body_text: parsed.bodyText,
    body_html: parsed.bodyHtml,
    attachments_json: JSON.stringify(parsed.attachments),
    label_ids: JSON.stringify(parsed.labelIds),
    original_sender: parsed.originalSender,
    reply_to: parsed.replyTo,
    list_unsubscribe: parsed.listUnsubscribe,
    auto_submitted: parsed.autoSubmitted,
    precedence: parsed.precedence,
    headers_json: JSON.stringify(parsed.headers),
    cached_at: new Date(),
  };
  await extDB
    .insert(gmailMessageTable)
    .values(row)
    .onConflictDoUpdate({
      target: gmailMessageTable.gmail_message_id,
      set: row,
    });
};

// Messages are processed oldest first so that the message which addressed the
// group seeds the thread before its replies are considered.
const fetchAndCache = async (
  logger: Logger,
  extDB: ExternalStateDB,
  client: GmailClient,
  mailbox: string,
  filterToAddress: string,
  ids: ReadonlyArray<string>
): Promise<number> => {
  let cached = 0;
  for (const id of ids) {
    const message = await withGoogleRateLimitRetry(
      logger,
      `fetching gmail message ${id}`,
      () => client.getMessage(id)
    );
    const parsed = parseGmailMessage(message);
    if (parsed === null) {
      logger.warn('Skipping unparseable gmail message %s', id);
      continue;
    }
    if (!(await isInScope(extDB, filterToAddress, parsed))) {
      continue;
    }
    await upsertMessage(extDB, mailbox, parsed);
    cached++;
  }
  return cached;
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as {code: unknown}).code === 404;

// Gmail answers an expired history cursor with the same 404.
const isHistoryExpired = isNotFound;

// How many rows lacking headers are fetched again per cycle. Enough that a
// mailbox of a few hundred messages is caught up within the hour; few
// enough that the loop, which runs everything in turn, is never held long.
const REFRESH_BATCH = 100;

// Rows imported before every header was kept are fetched again, by id, and
// rewritten with the full set. By id rather than by re-listing, because a
// listing covers the inbox and the rows most in need of this had already
// been archived out of it - which is how two copies of one Amazon notice
// came to sit in the cache with no way to ever judge one of them.
//
// Whatever a rule may need later, this is what makes it answerable for mail
// that is already here, without importing anything again.
const refreshRowsWithoutHeaders = async (
  logger: Logger,
  extDB: ExternalStateDB,
  client: GmailClient,
  mailbox: string
): Promise<number> => {
  const stale = await extDB
    .select({id: gmailMessageTable.gmail_message_id})
    .from(gmailMessageTable)
    .where(
      and(
        eq(gmailMessageTable.mailbox, mailbox),
        isNull(gmailMessageTable.headers_json)
      )
    )
    .limit(REFRESH_BATCH);

  // A row that cannot be refreshed is recorded as having no headers, so it
  // is not asked for again every cycle. The row itself stays: it was
  // correspondence when it arrived, and the mailbox is a record of that.
  const giveUp = (id: string) =>
    extDB
      .update(gmailMessageTable)
      .set({headers_json: '[]'})
      .where(eq(gmailMessageTable.gmail_message_id, id));

  let refreshed = 0;
  for (const {id} of stale) {
    let message: GmailApiMessage;
    try {
      message = await withGoogleRateLimitRetry(
        logger,
        `refreshing gmail message ${id}`,
        () => client.getMessage(id)
      );
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
      logger.warn(
        'Gmail no longer has message %s; keeping the cached copy as it is',
        id
      );
      await giveUp(id);
      continue;
    }
    const parsed = parseGmailMessage(message);
    if (parsed === null) {
      logger.warn('Skipping unparseable gmail message %s on refresh', id);
      await giveUp(id);
      continue;
    }
    await upsertMessage(extDB, mailbox, parsed);
    refreshed++;
  }
  return refreshed;
};

// Pulls the mailbox into the cache: a full INBOX listing on first run (or
// when the incremental cursor expires - Gmail keeps historyIds for roughly a
// week), incremental via history.list otherwise. Dedup/refresh by message id.
export const pullGmailData = async (
  logger: Logger,
  extDB: ExternalStateDB,
  clientFactory: GmailClientFactory,
  mailbox: string,
  filterToAddress: string
): Promise<void> => {
  const client = clientFactory(mailbox);
  const metadata = await extDB
    .select()
    .from(gmailSyncMetadataTable)
    .where(eq(gmailSyncMetadataTable.mailbox, mailbox));
  const lastHistoryId = metadata[0]?.last_history_id ?? null;

  let cached = 0;
  let nextHistoryId: string | null = null;

  if (lastHistoryId !== null) {
    try {
      const history = await withGoogleRateLimitRetry(
        logger,
        `listing gmail history for ${mailbox}`,
        () => client.listHistoryMessageIds(lastHistoryId)
      );
      cached = await fetchAndCache(
        logger,
        extDB,
        client,
        mailbox,
        filterToAddress,
        history.ids
      );
      nextHistoryId = history.historyId ?? lastHistoryId;
    } catch (error) {
      if (!isHistoryExpired(error)) {
        throw error;
      }
      logger.warn(
        'Gmail history cursor expired for %s - falling back to a full re-list',
        mailbox
      );
    }
  }

  if (nextHistoryId === null) {
    // Bootstrap (or expired-cursor) path: capture the profile's historyId
    // FIRST so anything arriving mid-listing is picked up next cycle.
    const profile = await withGoogleRateLimitRetry(
      logger,
      `getting gmail profile for ${mailbox}`,
      () => client.getProfile()
    );
    // Gmail's deliveredto: matches the final recipient - the member account,
    // not the group - so the group has to be looked for in the addressing
    // headers instead.
    const query =
      filterToAddress === ''
        ? ''
        : `{to:${filterToAddress} cc:${filterToAddress} bcc:${filterToAddress} deliveredto:${filterToAddress}}`;
    let pageToken: string | undefined;
    do {
      const page = await withGoogleRateLimitRetry(
        logger,
        `listing gmail messages for ${mailbox}`,
        () => client.listMessageIds(query, pageToken)
      );
      cached += await fetchAndCache(
        logger,
        extDB,
        client,
        mailbox,
        filterToAddress,
        page.ids
      );
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
    nextHistoryId = profile.historyId ?? null;
  }

  const now = new Date();
  await extDB
    .insert(gmailSyncMetadataTable)
    .values({mailbox, last_history_id: nextHistoryId, last_sync: now})
    .onConflictDoUpdate({
      target: gmailSyncMetadataTable.mailbox,
      set: {last_history_id: nextHistoryId, last_sync: now},
    });

  if (cached > 0) {
    logger.info('Cached %s gmail message(s) for %s', cached, mailbox);
  }

  const refreshed = await refreshRowsWithoutHeaders(
    logger,
    extDB,
    client,
    mailbox
  );
  if (refreshed > 0) {
    logger.info(
      'Refreshed the headers of %s cached gmail message(s) for %s',
      refreshed,
      mailbox
    );
  }
};
