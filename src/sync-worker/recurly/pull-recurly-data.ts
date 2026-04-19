import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import recurly from 'recurly';
import {DomainEvent} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {EmailAddressCodec} from '../../types/email-address';

import {constructEvent} from '../../types/domain-event';

import {DateTime, Duration} from 'luxon';
import {startSpan} from '@sentry/node';
import { ExternalStateDB } from '../external-state-db';
import { recurlySubscriptionTable } from './recurly-data-table';

const pullRecurlyData = (
  logger: Logger,
  extDB: ExternalStateDB,
  recurlyToken: string,
  recurlySyncInterval: Duration = Duration.fromMillis(1000 * 60 * 20),
) => {
    let lastRecurlySync: O.Option<DateTime> = O.none;
    return async () => {
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
        const client = new recurly.Client(recurlyToken);

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

            extDB.insert(
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
