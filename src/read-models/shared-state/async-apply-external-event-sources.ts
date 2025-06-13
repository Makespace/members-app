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

const RECURLY_SYNC_INTERVAL = Duration.fromMillis(1000 * 60 * 20);

let lastRecurlySync: O.Option<DateTime> = O.none;
async function asyncApplyRecurlyEvents(
  logger: Logger,
  currentState: BetterSQLite3Database,
  updateState: (event: DomainEvent) => void,
  recurlyToken: string
) {
  if (
    O.isSome(lastRecurlySync) &&
    lastRecurlySync.value.diffNow().negate() < RECURLY_SYNC_INTERVAL
  ) {
    logger.info(
      'Skipping recurly sync, next sync in %s',
      RECURLY_SYNC_INTERVAL.minus(
        lastRecurlySync.value.diffNow().negate()
      ).toHuman()
    );
    return;
  }
  lastRecurlySync = O.some(DateTime.now());

  await startSpan(
    {
      name: 'Recurly Event Sync',
    },
    async () => {
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

        const event = constructEvent('RecurlySubscriptionUpdated')({
          email: maybeEmail,
          hasActiveSubscription: hasActiveSubscription ?? false,
          hasFutureSubscription: hasFutureSubscription ?? false,
          hasCanceledSubscription: hasCanceledSubscription ?? false,
          hasPausedSubscription: hasPausedSubscription ?? false,
          hasPastDueInvoice: hasPastDueInvoice ?? false,
        });

        updateState(event);
      }
    }
  );

  logger.info('...done');
}

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  updateState: (event: DomainEvent) => void,
  recurlyToken: O.Option<string>
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
    if (O.isNone(recurlyToken)) {
      logger.info('Recurly external event source disabled');
    } else {
      await asyncApplyRecurlyEvents(
        logger,
        currentState,
        updateState,
        recurlyToken.value
      );
    }

    logger.info('Finished applying external event sources');
  };
};
