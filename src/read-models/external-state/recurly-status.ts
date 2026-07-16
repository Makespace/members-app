import { ExternalStateDB } from "../../sync-worker/external-state-db";
import { recurlySubscriptionTable } from "../../sync-worker/recurly/recurly-data-table";
import { EmailAddress } from "../../types";
import { gt, inArray, and } from 'drizzle-orm';
import { DateTime, Duration } from "luxon";
import { MemberCoreInfo } from "../shared-state/return-types";
import * as O from 'fp-ts/Option';

// If we haven't had a recurly update for an entry in the last 3 days then consider it stale and ignore it.
const RECURLY_TTL = Duration.fromObject({days: 3});

export type RecurlyStatus = 'inactive' | 'active';

const _getRecurlyStatus = (extDB: ExternalStateDB) => async (emails: EmailAddress[]): Promise<RecurlyStatus> => {
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

export const getRecurlyStatusForMember = (extDB: ExternalStateDB) => async (member: Pick<MemberCoreInfo, 'emails'>): Promise<RecurlyStatus> => {
    return _getRecurlyStatus(extDB)(member.emails.filter(e => O.isSome(e.verifiedAt)).map(e => e.emailAddress));
}

// --- Detailed membership reasons ---------------------------------------------
// Additive to the 'active' | 'inactive' calc above, which is deliberately left
// unchanged (it's used by other pages). This reports generic facts about a
// member's subscriptions; deciding what counts as "active enough" for a given
// purpose is left to the caller (e.g. the /areas page treats past-due as inactive).

export type RecurlyReason =
    | 'cancelled-in-term' // cancelled but still within the paid term (still has access)
    | 'paused'
    | 'past-due'
    | 'future-only' // signed up, but the subscription hasn't started yet
    | 'expired' // fresh data, but nothing live
    | 'no-data'; // no fresh recurly row at all (missing, stale, or email mismatch)

export type RecurlyFlags = {
    hasActiveSubscription: boolean;
    hasFutureSubscription: boolean;
    hasCanceledSubscription: boolean;
    hasPausedSubscription: boolean;
    hasPastDueInvoice: boolean;
};

// Aggregates every fresh recurly row for the given emails into one set of flags.
// Returns O.none when there's no fresh data at all, so callers can distinguish
// "we know there's nothing live" (expired) from "we don't currently know" (no-data).
const _getRecurlyFlags = (extDB: ExternalStateDB) => async (emails: EmailAddress[]): Promise<O.Option<RecurlyFlags>> => {
    if (emails.length === 0) {
        return O.none;
    }
    const rows = await extDB
        .select({
            hasActiveSubscription: recurlySubscriptionTable.hasActiveSubscription,
            hasFutureSubscription: recurlySubscriptionTable.hasFutureSubscription,
            hasCanceledSubscription: recurlySubscriptionTable.hasCanceledSubscription,
            hasPausedSubscription: recurlySubscriptionTable.hasPausedSubscription,
            hasPastDueInvoice: recurlySubscriptionTable.hasPastDueInvoice,
        })
        .from(recurlySubscriptionTable)
        .where(and(
            inArray(recurlySubscriptionTable.email, emails),
            gt(recurlySubscriptionTable.cacheLastUpdated, DateTime.now().minus(RECURLY_TTL).toJSDate())
        ))
        .all();
    if (rows.length === 0) {
        return O.none;
    }
    return O.some({
        hasActiveSubscription: rows.some(r => r.hasActiveSubscription),
        hasFutureSubscription: rows.some(r => r.hasFutureSubscription),
        hasCanceledSubscription: rows.some(r => r.hasCanceledSubscription),
        hasPausedSubscription: rows.some(r => r.hasPausedSubscription),
        hasPastDueInvoice: rows.some(r => r.hasPastDueInvoice),
    });
};

// Pure mapping from flags to reason codes. Guarantees at least one reason
// whenever there's no *active* subscription, so an inactive member is never
// left unexplained. A plainly-active member gets an empty list.
export const recurlyReasons = (flags: O.Option<RecurlyFlags>): ReadonlyArray<RecurlyReason> => {
    if (O.isNone(flags)) {
        return ['no-data'];
    }
    const f = flags.value;
    const reasons: RecurlyReason[] = [];
    if (f.hasCanceledSubscription) reasons.push('cancelled-in-term');
    if (f.hasPausedSubscription) reasons.push('paused');
    if (f.hasPastDueInvoice) reasons.push('past-due');
    if (f.hasFutureSubscription && !f.hasActiveSubscription) reasons.push('future-only');
    if (reasons.length === 0 && !f.hasActiveSubscription) reasons.push('expired');
    return reasons;
};

export const getRecurlyReasonsForMember = (extDB: ExternalStateDB) => async (
    member: Pick<MemberCoreInfo, 'emails'>
): Promise<{flags: O.Option<RecurlyFlags>; reasons: ReadonlyArray<RecurlyReason>}> => {
    const flags = await _getRecurlyFlags(extDB)(
        member.emails.filter(e => O.isSome(e.verifiedAt)).map(e => e.emailAddress)
    );
    return {flags, reasons: recurlyReasons(flags)};
};
