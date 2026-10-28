import * as E from 'fp-ts/Either';
import {and, count, eq, gte, lt, max} from 'drizzle-orm';
import {constructEvent, Email} from '../types';
import {EmailAddress} from '../types/email-address';
import {SyncWorkerDependencies} from './dependencies';
import {
  recurlyAccountCodeTable,
  recurlySubscriptionHistoryTable,
  recurlySyncMetadataTable,
  recurlyTransactionTable,
} from './recurly/recurly-data-table';
import {
  alertEmail,
  countTransactions,
  lastSummaryBoundary,
  summaryEmail,
} from '../recurly-monitor/activity';
import {ownersOf, superUsers} from '../purchasing/notification-recipients';
import {heldBackSendEmail} from '../trouble-tickets/notification-gate';

// Emails the management team when Recurly records an unusual number of blocked
// payments, and once a week summarises Recurly's activity regardless. It only
// reads the Recurly cache the sync keeps (see pull-recurly-data), so it never
// talks to Recurly itself. Mail goes through the same gate as every other
// notification (TROUBLE_TICKET_NOTIFY_TO). Markers are committed before
// sending, like the other emailers: a missed email over a duplicate.

type NotifyRecurlyActivityDependencies = Pick<
  SyncWorkerDependencies,
  | 'logger'
  | 'sharedReadModel'
  | 'getAllEventsByType'
  | 'commitEvent'
  | 'sendEmail'
  | 'conf'
  | 'extDB'
>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The management team, or the super users if there is no management team set
// up - somebody must hear about an attack.
const managers = (
  deps: NotifyRecurlyActivityDependencies
): ReadonlyArray<EmailAddress> => {
  const rm = deps.sharedReadModel;
  const team = ownersOf(rm, deps.conf.MANAGEMENT_TEAM_AREA_ID);
  const people = team.length > 0 ? team : superUsers(rm);
  return [...new Set(people.map(person => person.primaryEmailAddress))];
};

const transactionsBetween = (
  deps: NotifyRecurlyActivityDependencies,
  from: Date,
  to: Date
) =>
  deps.extDB
    .select({
      type: recurlyTransactionTable.type,
      status: recurlyTransactionTable.status,
      statusCode: recurlyTransactionTable.statusCode,
      origin: recurlyTransactionTable.origin,
      ipAddressCountry: recurlyTransactionTable.ipAddressCountry,
      amount: recurlyTransactionTable.amount,
    })
    .from(recurlyTransactionTable)
    .where(
      and(
        gte(recurlyTransactionTable.createdAt, from),
        lt(recurlyTransactionTable.createdAt, to)
      )
    )
    .all();

const countBetween = async (
  deps: NotifyRecurlyActivityDependencies,
  table:
    | typeof recurlyAccountCodeTable
    | typeof recurlySubscriptionHistoryTable,
  column:
    | typeof recurlyAccountCodeTable.createdAt
    | typeof recurlySubscriptionHistoryTable.activatedAt
    | typeof recurlySubscriptionHistoryTable.canceledAt,
  from: Date,
  to: Date
): Promise<number> => {
  const row = await deps.extDB
    .select({n: count()})
    .from(table)
    .where(and(gte(column, from), lt(column, to)))
    .get();
  return row?.n ?? 0;
};

// Whether the transaction cache has been filled since it was last rebuilt.
// Until it has, every count reads zero, which must not go out as a summary.
const transactionsSynced = async (deps: NotifyRecurlyActivityDependencies) =>
  (await deps.extDB
    .select({cursor: recurlySyncMetadataTable.cursor})
    .from(recurlySyncMetadataTable)
    .where(eq(recurlySyncMetadataTable.resource, 'transactions'))
    .get()) !== undefined;

const sendToManagers = async (
  deps: NotifyRecurlyActivityDependencies,
  build: (recipient: Email['recipient']) => Email,
  what: string
) => {
  const send = heldBackSendEmail(deps);
  for (const recipient of managers(deps)) {
    const sent = await send(build(recipient))();
    if (E.isLeft(sent)) {
      deps.logger.error({recipient, failure: sent.left}, `Failed to send ${what}`);
    }
  }
};

const checkForSuspiciousActivity = async (
  deps: NotifyRecurlyActivityDependencies,
  now: Date
) => {
  const hours = deps.conf.RECURLY_ALERT_WINDOW_HOURS;
  const threshold = deps.conf.RECURLY_ALERT_BLOCKED_THRESHOLD;
  const windowMs = hours * 60 * 60 * 1000;
  const counts = countTransactions(
    await transactionsBetween(deps, new Date(now.getTime() - windowMs), now)
  );
  if (counts.blockedPayments < threshold) {
    return;
  }

  const previous = await deps.getAllEventsByType('RecurlyActivityAlertSent')();
  if (E.isLeft(previous)) {
    deps.logger.warn(previous.left, 'Could not read past Recurly alerts - will retry');
    return;
  }
  const recentlyWarned = previous.right.some(
    event => now.getTime() - event.recordedAt.getTime() < windowMs
  );
  if (recentlyWarned) {
    return;
  }

  const rm = deps.sharedReadModel;
  const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
    constructEvent('RecurlyActivityAlertSent')({
      actor: {tag: 'system'},
      blockedCount: counts.blockedPayments,
      threshold,
      windowHours: hours,
    })
  )();
  if (E.isLeft(committed)) {
    deps.logger.warn(committed.left, 'Failed to record Recurly alert - will retry');
    return;
  }
  await rm.asyncRefresh()();

  deps.logger.warn(
    {blocked: counts.blockedPayments, threshold, hours},
    'Suspicious Recurly activity - alerting the management team'
  );
  await sendToManagers(
    deps,
    recipient => alertEmail(recipient, counts, {hours, threshold, until: now}),
    'Recurly activity alert'
  );
};

const sendWeeklySummary = async (
  deps: NotifyRecurlyActivityDependencies,
  now: Date
) => {
  const end = lastSummaryBoundary(now);
  const start = new Date(end.getTime() - WEEK_MS);

  const previous = await deps.getAllEventsByType('RecurlyActivitySummarySent')();
  if (E.isLeft(previous)) {
    deps.logger.warn(previous.left, 'Could not read past Recurly summaries - will retry');
    return;
  }
  if (previous.right.some(event => event.periodEnd.getTime() === end.getTime())) {
    return;
  }
  if (!(await transactionsSynced(deps))) {
    return;
  }

  const alerts = await deps.getAllEventsByType('RecurlyActivityAlertSent')();
  const alertsSent = E.isRight(alerts)
    ? alerts.right.filter(
        event => event.recordedAt >= start && event.recordedAt < end
      ).length
    : 0;
  const summary = {
    ...countTransactions(await transactionsBetween(deps, start, end)),
    newAccounts: await countBetween(deps, recurlyAccountCodeTable, recurlyAccountCodeTable.createdAt, start, end),
    newSubscriptions: await countBetween(deps, recurlySubscriptionHistoryTable, recurlySubscriptionHistoryTable.activatedAt, start, end),
    cancelledSubscriptions: await countBetween(deps, recurlySubscriptionHistoryTable, recurlySubscriptionHistoryTable.canceledAt, start, end),
    alertsSent,
  };
  const dataAsOf =
    (
      await deps.extDB
        .select({at: max(recurlyTransactionTable.cachedAt)})
        .from(recurlyTransactionTable)
        .get()
    )?.at ?? null;

  const rm = deps.sharedReadModel;
  const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
    constructEvent('RecurlyActivitySummarySent')({
      actor: {tag: 'system'},
      periodStart: start,
      periodEnd: end,
    })
  )();
  if (E.isLeft(committed)) {
    deps.logger.warn(committed.left, 'Failed to record Recurly summary - will retry');
    return;
  }
  await rm.asyncRefresh()();

  deps.logger.info({start, end, summary}, 'Sending the weekly Recurly summary');
  await sendToManagers(
    deps,
    recipient => summaryEmail(recipient, summary, {start, end, dataAsOf}),
    'weekly Recurly summary'
  );
};

export const notifyRecurlyActivity = async (
  deps: NotifyRecurlyActivityDependencies,
  now: Date = new Date()
): Promise<void> => {
  // Without a Recurly token there is no data, and a summary of zeros would
  // read as a quiet week.
  if (!deps.conf.RECURLY_TOKEN) {
    return;
  }
  await deps.sharedReadModel.asyncRefresh()();
  await checkForSuspiciousActivity(deps, now);
  await sendWeeklySummary(deps, now);
};
