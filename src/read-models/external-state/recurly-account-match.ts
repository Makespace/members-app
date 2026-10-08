import {inArray, or, sql} from 'drizzle-orm';
import * as O from 'fp-ts/Option';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  recurlyAccountCodeTable,
  recurlySubscriptionTable,
} from '../../sync-worker/recurly/recurly-data-table';
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
//
// Addresses and codes are stored lowercased by the sync and compared
// lowercased here; every path lowercases its input once and then compares
// exactly.

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

type AccountCodeRow = {code: string; email: string};

// Pure, for a caller that has already loaded every account code: the account
// emails a set of member addresses resolve to. The addresses themselves are
// kept, so an account the subscription cache has not seen yet (its invoices
// arrived first) still matches by email as before. Built once per table of
// codes, then cheap per member.
export const resolveAccountEmailsFrom = (
  codes: ReadonlyArray<AccountCodeRow>
): ((emails: ReadonlyArray<string>) => ReadonlyArray<string>) => {
  const emailByCode = new Map(
    codes.map(row => [row.code.toLowerCase(), row.email.toLowerCase()])
  );
  return emails => {
    const resolved = new Set(emails.map(email => email.toLowerCase()));
    for (const email of [...resolved]) {
      const viaCode = emailByCode.get(email);
      if (viaCode !== undefined) {
        resolved.add(viaCode);
      }
    }
    return [...resolved];
  };
};

// One query for the account-code rows naming any of these addresses, for
// callers that then resolve several members' addresses in memory.
export const loadAccountCodesAmong =
  (extDB: ExternalStateDB) =>
  async (emails: ReadonlyArray<string>): Promise<ReadonlyArray<AccountCodeRow>> => {
    const lowered = [...new Set(emails.map(email => email.toLowerCase()))];
    if (lowered.length === 0) {
      return [];
    }
    return extDB
      .select({
        code: recurlyAccountCodeTable.code,
        email: recurlyAccountCodeTable.email,
      })
      .from(recurlyAccountCodeTable)
      .where(inArray(recurlyAccountCodeTable.code, lowered))
      .all();
  };

// As above, for one member at a time: one query for the accounts their
// addresses name by code.
export const resolveAccountEmails =
  (extDB: ExternalStateDB) =>
  async (emails: ReadonlyArray<string>): Promise<ReadonlyArray<string>> =>
    resolveAccountEmailsFrom(await loadAccountCodesAmong(extDB)(emails))(
      [...new Set(emails.map(email => email.toLowerCase()))]
    );

// A where-clause for the subscription cache itself: rows whose billing email
// is one of these addresses, or is what one of them resolves to by code.
export const subscriptionMatches = (emails: ReadonlyArray<string>) => {
  const lowered = emails.map(email => email.toLowerCase());
  const billingEmail = sql`lower(${recurlySubscriptionTable.email})`;
  return or(
    inArray(billingEmail, lowered),
    inArray(billingEmail, billingEmailsForCodes(lowered))
  );
};

// Subquery: the billing emails of the accounts whose code is one of these.
const billingEmailsForCodes = (codes: ReadonlyArray<string>) =>
  sql`(select ${recurlyAccountCodeTable.email} from ${recurlyAccountCodeTable} where ${inArray(
    recurlyAccountCodeTable.code,
    [...codes]
  )})`;
