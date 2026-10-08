import {inArray, or, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {recurlySubscriptionTable} from '../../sync-worker/recurly/recurly-data-table';
import {MemberCoreInfo} from '../shared-state/return-types';

// The one place that says how a member is matched to Recurly.
//
// A member's side is their verified email addresses. Recurly's side is an
// account, which carries two addresses that both count: the email it bills
// now, and the account code, which Makespace sets to the email the member
// signed up with and which they may still be known by in the app. Everything
// cached from Recurly (invoices, transactions, subscription history) is keyed
// by the account's *email*, so matching resolves a member's addresses to the
// account emails they stand for, and lookups go on from there.

// Which of a member's addresses may be matched: verified ones, lowercased as
// the cache stores them.
export const memberRecurlyEmails = (
  member: Pick<MemberCoreInfo, 'emails'>
): ReadonlyArray<string> => [
  ...new Set(
    member.emails
      .filter(email => O.isSome(email.verifiedAt))
      .map(email => email.emailAddress.toLowerCase())
  ),
];

type AccountRow = {email: string; accountCode: string | null};

// Pure: given every cached account, the account emails that a set of member
// addresses resolve to. The addresses themselves are kept, so an account the
// subscription cache has not seen yet (its invoices arrived first) still
// matches by email as before.
export const resolveAccountEmailsFrom =
  (accounts: ReadonlyArray<AccountRow>) =>
  (emails: ReadonlyArray<string>): ReadonlyArray<string> => {
    const wanted = new Set(emails.map(email => email.toLowerCase()));
    const resolved = new Set(wanted);
    for (const account of accounts) {
      if (
        account.accountCode !== null &&
        wanted.has(account.accountCode.toLowerCase())
      ) {
        resolved.add(account.email.toLowerCase());
      }
    }
    return [...resolved];
  };

// As above, for one member at a time: one query for the accounts their
// addresses name by code.
export const resolveAccountEmails =
  (extDB: ExternalStateDB) =>
  async (emails: ReadonlyArray<string>): Promise<ReadonlyArray<string>> => {
    const lowered = [...new Set(emails.map(email => email.toLowerCase()))];
    if (lowered.length === 0) {
      return [];
    }
    const accounts = await extDB
      .select({
        email: recurlySubscriptionTable.email,
        accountCode: recurlySubscriptionTable.accountCode,
      })
      .from(recurlySubscriptionTable)
      .where(inArray(recurlySubscriptionTable.accountCode, lowered))
      .all();
    return resolveAccountEmailsFrom(accounts)(lowered);
  };

// A where-clause for the subscription cache itself: rows whose billing email
// or account code is one of these addresses.
export const subscriptionMatches = (emails: ReadonlyArray<string>) => {
  const lowered = emails.map(email => email.toLowerCase());
  return or(
    inArray(sql`lower(${recurlySubscriptionTable.email})`, lowered),
    inArray(recurlySubscriptionTable.accountCode, lowered)
  );
};
