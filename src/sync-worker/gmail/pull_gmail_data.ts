import {Logger} from 'pino';
import {eq} from 'drizzle-orm';
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
// addressed or delivered to the group. The bootstrap listing filters
// server-side too, but history.list can't, so this covers the incremental
// path (and anything the server-side query misses).
const matchesFilter = (
  filterToAddress: string,
  parsed: ParsedGmailMessage
): boolean => {
  if (filterToAddress === '') {
    return true;
  }
  const needle = filterToAddress.toLowerCase();
  return [parsed.deliveredTo, parsed.toAddresses, parsed.ccAddresses].some(
    header => header !== null && header.toLowerCase().includes(needle)
  );
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
    if (!matchesFilter(filterToAddress, parsed)) {
      continue;
    }
    await upsertMessage(extDB, mailbox, parsed);
    cached++;
  }
  return cached;
};

const isHistoryExpired = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as {code: unknown}).code === 404;

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
    const query =
      filterToAddress === '' ? '' : `deliveredto:${filterToAddress}`;
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
};
