import { ExternalStateDB } from "../../sync-worker/external-state-db";
import { recurlySubscriptionTable } from "../../sync-worker/recurly/recurly-data-table";
import { EmailAddress } from "../../types";
import { gt, inArray, and } from 'drizzle-orm';
import { DateTime, Duration } from "luxon";

// If we haven't had a recurly update for an entry in the last 3 days then consider it stale and ignore it.
const RECURLY_TTL = Duration.fromObject({days: 3});

export type RecurlyStatus = 'inactive' | 'active';

export const getRecurlyStatus = (extDB: ExternalStateDB) => async (emails: EmailAddress[]): Promise<RecurlyStatus> => {
    const entries = await extDB
        .select({
            hasActiveSubscription: recurlySubscriptionTable.hasActiveSubscription,
        })
        .from(recurlySubscriptionTable)
        .where(and(
            inArray(recurlySubscriptionTable.email, emails),
            gt(recurlySubscriptionTable.cacheLastUpdated, DateTime.now().minus(RECURLY_TTL).toJSDate())
        ))
        .all();
    return entries.some(row => row.hasActiveSubscription) ? 'active' : 'inactive';
};
