import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import recurly from 'recurly';
import {eq} from 'drizzle-orm';
import {EmailAddressCodec} from '../../types/email-address';
import {DateTime, Duration} from 'luxon';
import { ExternalStateDB } from '../external-state-db';
import {
  recurlyInvoiceTable,
  recurlySubscriptionTable,
  recurlySyncMetadataTable,
  recurlyTransactionTable,
} from './recurly-data-table';

type RecurlyAccount = {
    id?: string | null;
    email?: string | null;
    hasActiveSubscription?: boolean | null;
    hasFutureSubscription?: boolean | null;
    hasCanceledSubscription?: boolean | null;
    hasPausedSubscription?: boolean | null;
    hasPastDueInvoice?: boolean | null;
};

type RecurlyAccountMini = {
    id?: string | null;
    email?: string | null;
};

type RecurlyInvoice = {
    id?: string | null;
    account?: RecurlyAccountMini | null;
    number?: string | null;
    state?: string | null;
    collectionMethod?: string | null;
    currency?: string | null;
    total?: number | null;
    paid?: number | null;
    balance?: number | null;
    createdAt?: Date | null;
    dueAt?: Date | null;
    closedAt?: Date | null;
    dunningEventsSent?: number | null;
    finalDunningEvent?: boolean | null;
    subscriptionIds?: string[] | null;
    updatedAt?: Date | null;
};

type RecurlyPaymentMethod = {
    cardType?: string | null;
    lastFour?: string | null;
    expMonth?: number | null;
    expYear?: number | null;
};

type RecurlyTransaction = {
    id?: string | null;
    account?: RecurlyAccountMini | null;
    invoice?: {id?: string | null} | null;
    type?: string | null;
    status?: string | null;
    success?: boolean | null;
    refunded?: boolean | null;
    amount?: number | null;
    currency?: string | null;
    createdAt?: Date | null;
    collectedAt?: Date | null;
    updatedAt?: Date | null;
    paymentMethod?: RecurlyPaymentMethod | null;
    statusMessage?: string | null;
    customerMessage?: string | null;
    gatewayMessage?: string | null;
    merchantReasonCode?: string | null;
};

export type RecurlyClientFactory = (token: string) => {
    listAccounts: () => {
        each: () => AsyncIterable<RecurlyAccount>;
    };
    listInvoices: (options?: object) => {
        each: () => AsyncIterable<RecurlyInvoice>;
    };
    listTransactions: (options?: object) => {
        each: () => AsyncIterable<RecurlyTransaction>;
    };
};

// How far back the first pull reaches. Long enough to show a member's recent
// billing history and to catch anybody already deep in arrears, without
// dragging in the whole history of the site.
const BACKFILL_WINDOW = Duration.fromObject({months: 18});

// The cursor is rewound by this much each time it advances. Recurly orders by
// updated_at, and two records written in the same instant can straddle a page
// boundary, so a little re-reading is much cheaper than a missed invoice.
const CURSOR_OVERLAP = Duration.fromObject({minutes: 5});

// Recurly's maximum.
const PAGE_LIMIT = 200;

// Recurly emails can differ in case from our records (e.g. Foo@HotMail.com),
// so store them lowercased.
const emailOf = (address: string | null | undefined): string | undefined =>
    E.getOrElseW(() => undefined)(
        EmailAddressCodec.decode(
            typeof address === 'string' ? address.toLowerCase() : address
        )
    );

const readCursor = async (
    extDB: ExternalStateDB,
    resource: string
): Promise<Date> => {
    const row = await extDB
        .select({cursor: recurlySyncMetadataTable.cursor})
        .from(recurlySyncMetadataTable)
        .where(eq(recurlySyncMetadataTable.resource, resource))
        .get();
    return row?.cursor ?? DateTime.now().minus(BACKFILL_WINDOW).toJSDate();
};

const writeCursor = async (
    extDB: ExternalStateDB,
    resource: string,
    cursor: Date
): Promise<void> => {
    await extDB
        .insert(recurlySyncMetadataTable)
        .values({resource, cursor})
        .onConflictDoUpdate({
            target: recurlySyncMetadataTable.resource,
            set: {cursor},
        })
        .run();
};

// Asks Recurly only for what has changed since the last pull, and returns where
// the next one should start. `sort=updated_at` ascending is the only ordering
// Recurly guarantees is safe to page through while records are being written.
const incrementalPull = async <T>(
    extDB: ExternalStateDB,
    resource: string,
    list: (options?: object) => {each: () => AsyncIterable<T>},
    updatedAtOf: (record: T) => Date | null | undefined,
    store: (record: T) => Promise<boolean>
): Promise<{seen: number; stored: number}> => {
    const cursor = await readCursor(extDB, resource);
    let newest = cursor.getTime();
    let seen = 0;
    let stored = 0;

    const page = list({
        params: {
            sort: 'updated_at',
            order: 'asc',
            beginTime: cursor,
            limit: PAGE_LIMIT,
        },
    });
    for await (const record of page.each()) {
        seen++;
        if (await store(record)) {
            stored++;
        }
        const updatedAt = updatedAtOf(record);
        if (updatedAt && updatedAt.getTime() > newest) {
            newest = updatedAt.getTime();
        }
    }

    // Only ever forwards: with nothing new, `newest` is still the cursor we
    // started from, and subtracting the overlap would walk it backwards a
    // little on every cycle.
    const next = Math.max(cursor.getTime(), newest - CURSOR_OVERLAP.toMillis());
    if (next > cursor.getTime()) {
        await writeCursor(extDB, resource, new Date(next));
    }
    return {seen, stored};
};

const storeInvoice = (extDB: ExternalStateDB) => async (
    invoice: RecurlyInvoice
): Promise<boolean> => {
    const email = emailOf(invoice.account?.email);
    // Without an address there is no member to join the invoice to, and
    // without an id there is nothing to key it by.
    if (email === undefined || !invoice.id || !invoice.account?.id) {
        return false;
    }
    const values = {
        id: invoice.id,
        email,
        accountId: invoice.account.id,
        number: invoice.number ?? null,
        state: invoice.state ?? 'unknown',
        collectionMethod: invoice.collectionMethod ?? null,
        currency: invoice.currency ?? null,
        total: invoice.total ?? null,
        paid: invoice.paid ?? null,
        balance: invoice.balance ?? null,
        createdAt: invoice.createdAt ?? null,
        dueAt: invoice.dueAt ?? null,
        closedAt: invoice.closedAt ?? null,
        dunningEventsSent: invoice.dunningEventsSent ?? null,
        finalDunningEvent: invoice.finalDunningEvent ?? null,
        subscriptionIds: invoice.subscriptionIds
            ? JSON.stringify(invoice.subscriptionIds)
            : null,
        updatedAt: invoice.updatedAt ?? null,
        cachedAt: new Date(),
    };
    await extDB
        .insert(recurlyInvoiceTable)
        .values(values)
        .onConflictDoUpdate({
            target: recurlyInvoiceTable.id,
            set: values,
        })
        .run();
    return true;
};

const storeTransaction = (extDB: ExternalStateDB) => async (
    transaction: RecurlyTransaction
): Promise<boolean> => {
    const email = emailOf(transaction.account?.email);
    if (email === undefined || !transaction.id) {
        return false;
    }
    const values = {
        id: transaction.id,
        invoiceId: transaction.invoice?.id ?? null,
        email,
        type: transaction.type ?? null,
        status: transaction.status ?? null,
        success: transaction.success ?? null,
        refunded: transaction.refunded ?? null,
        amount: transaction.amount ?? null,
        currency: transaction.currency ?? null,
        createdAt: transaction.createdAt ?? null,
        collectedAt: transaction.collectedAt ?? null,
        cardType: transaction.paymentMethod?.cardType ?? null,
        lastFour: transaction.paymentMethod?.lastFour ?? null,
        expMonth: transaction.paymentMethod?.expMonth ?? null,
        expYear: transaction.paymentMethod?.expYear ?? null,
        statusMessage: transaction.statusMessage ?? null,
        customerMessage: transaction.customerMessage ?? null,
        gatewayMessage: transaction.gatewayMessage ?? null,
        merchantReasonCode: transaction.merchantReasonCode ?? null,
        updatedAt: transaction.updatedAt ?? null,
        cachedAt: new Date(),
    };
    await extDB
        .insert(recurlyTransactionTable)
        .values(values)
        .onConflictDoUpdate({
            target: recurlyTransactionTable.id,
            set: values,
        })
        .run();
    return true;
};

export const pullRecurlyData = (
  logger: Logger,
  extDB: ExternalStateDB,
  recurlyToken: string,
  createRecurlyClient: RecurlyClientFactory = token => new recurly.Client(token),
) => {
    let lastRecurlySync: O.Option<DateTime> = O.none;
    return async (recurlySyncInterval: Duration = Duration.fromMillis(1000 * 60 * 20)) => {
        if (
            O.isSome(lastRecurlySync) &&
            lastRecurlySync.value.diffNow().negate() < recurlySyncInterval
        ) {
            logger.debug(
            'Skipping recurly sync, next sync in %s',
            recurlySyncInterval.minus(
                lastRecurlySync.value.diffNow().negate()
            ).toHuman()
            );
            return;
        }
        lastRecurlySync = O.some(DateTime.now());

        logger.info('Fetching recurly events...');
        const client = createRecurlyClient(recurlyToken);

        const accounts = client.listAccounts();
        for await (const account of accounts.each()) {
            const {
                id,
                email,
                hasActiveSubscription,
                hasFutureSubscription,
                hasCanceledSubscription,
                hasPausedSubscription,
                hasPastDueInvoice,
            } = account;

            const maybeEmail = emailOf(email);

            if (maybeEmail === undefined) {
                continue;
            }

            const values = {
                accountId: id ?? null,
                cacheLastUpdated: new Date(),
                hasActiveSubscription: hasActiveSubscription ?? false,
                hasFutureSubscription: hasFutureSubscription ?? false,
                hasCanceledSubscription: hasCanceledSubscription ?? false,
                hasPausedSubscription: hasPausedSubscription ?? false,
                hasPastDueInvoice: hasPastDueInvoice ?? false,
            };
            await extDB.insert(
                recurlySubscriptionTable
            ).values({
                email: maybeEmail,
                ...values,
            }).onConflictDoUpdate(
                {
                    target: recurlySubscriptionTable.email,
                    set: values,
                }
            ).run();
        }

        const invoices = await incrementalPull(
            extDB,
            'invoices',
            options => client.listInvoices(options),
            invoice => invoice.updatedAt,
            storeInvoice(extDB)
        );
        const transactions = await incrementalPull(
            extDB,
            'transactions',
            options => client.listTransactions(options),
            transaction => transaction.updatedAt,
            storeTransaction(extDB)
        );

        logger.info(
            {invoices, transactions},
            'Finished fetching recurly data'
        );
    }
}
