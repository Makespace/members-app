import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import recurly from 'recurly';
import {EmailAddressCodec} from '../../types/email-address';
import {DateTime, Duration} from 'luxon';
import { ExternalStateDB } from '../external-state-db';
import { recurlySubscriptionTable } from './recurly-data-table';

type RecurlyAccount = {
    email?: string | null;
    hasActiveSubscription?: boolean | null;
    hasFutureSubscription?: boolean | null;
    hasCanceledSubscription?: boolean | null;
    hasPausedSubscription?: boolean | null;
    hasPastDueInvoice?: boolean | null;
};

export type RecurlyClientFactory = (token: string) => {
    listAccounts: () => {
        each: () => AsyncIterable<RecurlyAccount>;
    };
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
            logger.info(
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
                email,
                hasActiveSubscription,
                hasFutureSubscription,
                hasCanceledSubscription,
                hasPausedSubscription,
                hasPastDueInvoice,
            } = account;

            const maybeEmail = E.getOrElseW(() => undefined)(
                EmailAddressCodec.decode(email)
            );

            if (maybeEmail === undefined) {
                continue;
            }

            await extDB.insert(
                recurlySubscriptionTable
            ).values({
                email: maybeEmail,
                cacheLastUpdated: new Date(),
                hasActiveSubscription: hasActiveSubscription ?? false,
                hasFutureSubscription: hasFutureSubscription ?? false,
                hasCanceledSubscription: hasCanceledSubscription ?? false,
                hasPausedSubscription: hasPausedSubscription ?? false,
                hasPastDueInvoice: hasPastDueInvoice ?? false,
            }).onConflictDoUpdate(
                {
                    target: recurlySubscriptionTable.email,
                    set: {
                        cacheLastUpdated: new Date(),
                        hasActiveSubscription: hasActiveSubscription ?? false,
                        hasFutureSubscription: hasFutureSubscription ?? false,
                        hasCanceledSubscription: hasCanceledSubscription ?? false,
                        hasPausedSubscription: hasPausedSubscription ?? false,
                        hasPastDueInvoice: hasPastDueInvoice ?? false,
                    }
                }
            ).run();
        }

        logger.info('Finished fetching recurly data');
    }
}
