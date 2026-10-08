import * as O from 'fp-ts/Option';
import {EmailAddress} from '../../../src/types';
import {
  memberRecurlyEmails,
  resolveAccountEmails,
  resolveAccountEmailsFrom,
} from '../../../src/read-models/external-state/recurly-account-match';
import {getRecurlyStatusForMember} from '../../../src/read-models/external-state/recurly-status';
import {getBillingForMember} from '../../../src/read-models/external-state/recurly-billing';
import {getSubscriptionHistoryForEmails} from '../../../src/read-models/external-state/membership-gap';
import {
  recurlyInvoiceTable,
  recurlySubscriptionHistoryTable,
} from '../../../src/sync-worker/recurly/recurly-data-table';
import {initTestFramework, TestFramework} from '../test-framework';
import {insertRecurlySubscription} from '../../helpers';

const email = (emailAddress: string, verified: boolean) => ({
  emailAddress: emailAddress as EmailAddress,
  verifiedAt: verified ? O.some(new Date()) : O.none,
  verificationLastSent: O.none,
  addedAt: new Date(),
});

describe('memberRecurlyEmails', () => {
  it('is the verified addresses, lowercased and deduplicated', () => {
    expect(
      memberRecurlyEmails({
        emails: [
          email('Signup@Example.com', true),
          email('signup@example.com', true),
          email('unverified@example.com', false),
        ],
      })
    ).toStrictEqual(['signup@example.com']);
  });
});

describe('resolveAccountEmailsFrom', () => {
  const accounts = [
    {code: 'signup@example.com', email: 'billing@example.com'},
    {code: 'same@example.com', email: 'same@example.com'},
  ];

  it('adds the billing email of an account whose code is one of the addresses', () => {
    expect(
      [...resolveAccountEmailsFrom(accounts)(['signup@example.com'])].sort()
    ).toStrictEqual(['billing@example.com', 'signup@example.com']);
  });

  it('keeps the addresses themselves, for caches keyed by billing email', () => {
    expect(resolveAccountEmailsFrom(accounts)(['old@example.com'])).toStrictEqual([
      'old@example.com',
    ]);
  });

  // The case the table exists for: two accounts bill one address.
  it('lets two codes point at the same billing email', () => {
    const resolve = resolveAccountEmailsFrom([
      {code: 'old@example.com', email: 'new@example.com'},
      {code: 'new@example.com', email: 'new@example.com'},
    ]);
    expect(resolve(['old@example.com'])).toContain('new@example.com');
    expect(resolve(['new@example.com'])).toStrictEqual(['new@example.com']);
  });

  it('matches codes case-insensitively', () => {
    expect(
      resolveAccountEmailsFrom(accounts)(['SIGNUP@example.com'])
    ).toContain('billing@example.com');
  });
});

describe('matching a member to Recurly by account code', () => {
  let framework: TestFramework;
  // The member signed up (and is known to the app) as signup@; Recurly now
  // bills billing@ but still carries signup@ as the account code.
  const signup = 'signup@example.com';
  const billing = 'billing@example.com';
  const member = {emails: [email(signup, true)]};

  beforeEach(async () => {
    framework = await initTestFramework();
    await insertRecurlySubscription(framework.extDB, {
      email: billing as EmailAddress,
      accountCode: signup,
      hasActiveSubscription: true,
    });
  });
  afterEach(() => {
    framework.close();
  });

  it('resolves the member to the account email', async () => {
    expect(
      [...(await resolveAccountEmails(framework.extDB)([signup]))].sort()
    ).toStrictEqual([billing, signup]);
  });

  it('counts them active', async () => {
    expect(await getRecurlyStatusForMember(framework.extDB)(member)).toBe(
      'active'
    );
  });

  it('finds their invoices', async () => {
    await framework.extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_1',
        email: billing,
        accountId: 'acct_1',
        state: 'past_due',
        currency: 'GBP',
        total: 30,
        paid: 0,
        balance: 30,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        dueAt: new Date('2026-08-01T00:00:00.000Z'),
        cachedAt: new Date(),
      })
      .run();
    const result = await getBillingForMember(framework.extDB)(member);
    expect(result.invoices).toHaveLength(1);
    expect(result.totalOutstanding).toBe(30);
  });

  it('finds their subscription history', async () => {
    await framework.extDB
      .insert(recurlySubscriptionHistoryTable)
      .values({
        id: 'sub_1',
        email: billing,
        accountId: 'acct_1',
        planCode: 'monthly',
        state: 'active',
        activatedAt: new Date('2026-01-01T00:00:00.000Z'),
        cachedAt: new Date(),
      })
      .run();
    const history = await getSubscriptionHistoryForEmails(framework.extDB)([
      signup as EmailAddress,
    ]);
    expect(history.map(s => s.id)).toStrictEqual(['sub_1']);
  });

  it('does not match an unverified address, even by code', async () => {
    expect(
      await getRecurlyStatusForMember(framework.extDB)({
        emails: [email(signup, false)],
      })
    ).toBe('inactive');
  });
});
