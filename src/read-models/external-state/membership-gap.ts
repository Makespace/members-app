import {desc, inArray} from 'drizzle-orm';
import {resolveAccountEmails} from './recurly-account-match';
import {DateTime, Duration} from 'luxon';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {recurlySubscriptionHistoryTable} from '../../sync-worker/recurly/recurly-data-table';
import {EmailAddress} from '../../types';

// How long somebody has to be gone before their training no longer counts.
export const TRAINING_LAPSES_AFTER = Duration.fromObject({months: 6});

export type SubscriptionSummary = {
  id: string;
  email: string;
  planCode: string | null;
  state: string;
  startedAt: Date | null;
  endedAt: Date | null;
};

// What Recurly's subscription history says about the gap between a member's
// previous membership and their current one. Each shape is a different amount
// of knowledge, so the page can say exactly what is and isn't known rather
// than guess.
export type MembershipGap =
  | {
      tag: 'known';
      previousEndedAt: Date;
      currentStartedAt: Date;
      monthsAway: number;
      lapsed: boolean;
    }
  // Their old membership ended but Recurly shows nothing live for them yet.
  // The gap so far is a lower bound: if it is already over the threshold the
  // answer is settled whatever happens next.
  | {tag: 'no-current'; previousEndedAt: Date; monthsAway: number; lapsed: boolean}
  // Something is live but nothing earlier ever ended - either they never
  // left, or the old membership was under an address we don't know about.
  | {tag: 'no-previous'; currentStartedAt: Date}
  | {tag: 'no-data'};

const LIVE_STATES: ReadonlySet<string> = new Set([
  'active',
  'canceled', // cancelled but still inside the paid term
  'paused',
  'future',
]);

const wholeMonthsBetween = (from: Date, to: Date): number =>
  Math.max(
    0,
    Math.floor(
      DateTime.fromJSDate(to).diff(DateTime.fromJSDate(from), 'months').months
    )
  );

const hasLapsed = (previousEndedAt: Date, until: Date): boolean =>
  DateTime.fromJSDate(previousEndedAt).plus(TRAINING_LAPSES_AFTER) <=
  DateTime.fromJSDate(until);

export const membershipGap = (
  subscriptions: ReadonlyArray<SubscriptionSummary>,
  now: Date
): MembershipGap => {
  const liveStarts = subscriptions
    .filter(s => LIVE_STATES.has(s.state) && s.startedAt !== null)
    .map(s => s.startedAt as Date);
  const currentStartedAt =
    liveStarts.length === 0
      ? null
      : new Date(Math.min(...liveStarts.map(d => d.getTime())));

  // Only endings from before the current membership began count as "the gap";
  // a locker that expired after they came back is not them leaving.
  const endings = subscriptions
    .filter(s => !LIVE_STATES.has(s.state) && s.endedAt !== null)
    .map(s => s.endedAt as Date)
    .filter(d => currentStartedAt === null || d <= currentStartedAt);
  const previousEndedAt =
    endings.length === 0
      ? null
      : new Date(Math.max(...endings.map(d => d.getTime())));

  if (previousEndedAt !== null && currentStartedAt !== null) {
    return {
      tag: 'known',
      previousEndedAt,
      currentStartedAt,
      monthsAway: wholeMonthsBetween(previousEndedAt, currentStartedAt),
      lapsed: hasLapsed(previousEndedAt, currentStartedAt),
    };
  }
  if (previousEndedAt !== null) {
    return {
      tag: 'no-current',
      previousEndedAt,
      monthsAway: wholeMonthsBetween(previousEndedAt, now),
      lapsed: hasLapsed(previousEndedAt, now),
    };
  }
  if (currentStartedAt !== null) {
    return {tag: 'no-previous', currentStartedAt};
  }
  return {tag: 'no-data'};
};

// Every subscription Recurly holds against any of these addresses, newest
// first. Addresses are compared lowercased, as the cache stores them.
export const getSubscriptionHistoryForEmails =
  (extDB: ExternalStateDB) =>
  async (
    emails: ReadonlyArray<EmailAddress>
  ): Promise<ReadonlyArray<SubscriptionSummary>> => {
    const lowered = await resolveAccountEmails(extDB)(emails);
    if (lowered.length === 0) {
      return [];
    }
    const rows = await extDB
      .select()
      .from(recurlySubscriptionHistoryTable)
      .where(inArray(recurlySubscriptionHistoryTable.email, [...lowered]))
      .orderBy(desc(recurlySubscriptionHistoryTable.activatedAt))
      .all();
    return rows.map(row => ({
      id: row.id,
      email: row.email ?? '',
      planCode: row.planCode,
      state: row.state,
      startedAt: row.activatedAt,
      // expiresAt is when access actually stopped; the others are fallbacks
      // for the odd record Recurly leaves it off.
      endedAt: LIVE_STATES.has(row.state)
        ? null
        : row.expiresAt ?? row.currentPeriodEndsAt ?? row.canceledAt,
    }));
  };
