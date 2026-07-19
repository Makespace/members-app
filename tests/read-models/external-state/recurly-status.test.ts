import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {EmailAddress} from '../../../src/types/email-address';
import {
  getRecurlyReasonsForMember,
  getRecurlyStatusForMember,
  recurlyReasons,
  RecurlyFlags,
} from '../../../src/read-models/external-state/recurly-status';
import {
  initTestFramework,
  TestFramework,
} from '../test-framework';
import {insertRecurlySubscription} from '../../helpers';

const verifiedEmail = (emailAddress: EmailAddress) => ({
  emailAddress,
  verifiedAt: O.some(new Date()),
  verificationLastSent: O.none,
  addedAt: new Date(),
});

const unverifiedEmail = (emailAddress: EmailAddress) => ({
  emailAddress,
  verifiedAt: O.none,
  verificationLastSent: O.none,
  addedAt: new Date(),
});

describe('recurly status', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  it('is active when any verified email has a fresh active subscription', async () => {
    const activeEmail = 'active@example.com' as EmailAddress;
    await insertRecurlySubscription(framework.extDB, {
      email: activeEmail,
      hasActiveSubscription: true,
    });

    const status = await getRecurlyStatusForMember(framework.extDB)({
      emails: [
        verifiedEmail('inactive@example.com' as EmailAddress),
        verifiedEmail(activeEmail),
      ],
    });

    expect(status).toStrictEqual('active');
  });

  it('is inactive when matching subscriptions are not active', async () => {
    const email = 'inactive@example.com' as EmailAddress;
    await insertRecurlySubscription(framework.extDB, {
      email,
      hasActiveSubscription: false,
    });

    const status = await getRecurlyStatusForMember(framework.extDB)({
      emails: [verifiedEmail(email)],
    });

    expect(status).toStrictEqual('inactive');
  });

  it('ignores active subscriptions on unverified email addresses', async () => {
    const email = 'unverified@example.com' as EmailAddress;
    await insertRecurlySubscription(framework.extDB, {
      email,
      hasActiveSubscription: true,
    });

    const status = await getRecurlyStatusForMember(framework.extDB)({
      emails: [unverifiedEmail(email)],
    });

    expect(status).toStrictEqual('inactive');
  });

  it('ignores active subscriptions from stale cache rows', async () => {
    const email = 'stale@example.com' as EmailAddress;
    await insertRecurlySubscription(framework.extDB, {
      email,
      hasActiveSubscription: true,
      cacheLastUpdated: DateTime.now().minus({days: 4}).toJSDate(),
    });

    const status = await getRecurlyStatusForMember(framework.extDB)({
      emails: [verifiedEmail(email)],
    });

    expect(status).toStrictEqual('inactive');
  });

  it('reports cancelled-but-in-term as a reason (still has access)', async () => {
    const email = 'cancelled@example.com' as EmailAddress;
    await insertRecurlySubscription(framework.extDB, {
      email,
      hasActiveSubscription: false,
      hasCanceledSubscription: true,
    });

    const {flags, reasons} = await getRecurlyReasonsForMember(framework.extDB)({
      emails: [verifiedEmail(email)],
    });

    expect(reasons).toStrictEqual(['cancelled-in-term']);
    expect(flags).toStrictEqual(
      O.some(
        expect.objectContaining({
          hasCanceledSubscription: true,
          hasActiveSubscription: false,
        })
      )
    );
  });

  it('reports a missing/stale recurly row as no-data (not expired)', async () => {
    const {flags, reasons} = await getRecurlyReasonsForMember(framework.extDB)({
      emails: [verifiedEmail('unknown@example.com' as EmailAddress)],
    });

    expect(flags).toStrictEqual(O.none);
    expect(reasons).toStrictEqual(['no-data']);
  });
});

describe('recurlyReasons (flags -> reason codes)', () => {
  const flags = (overrides: Partial<RecurlyFlags>) =>
    O.some({
      hasActiveSubscription: false,
      hasFutureSubscription: false,
      hasCanceledSubscription: false,
      hasPausedSubscription: false,
      hasPastDueInvoice: false,
      ...overrides,
    });

  it('reports no reasons for a plain active subscription', () => {
    expect(recurlyReasons(flags({hasActiveSubscription: true}))).toStrictEqual(
      []
    );
  });

  it('reports cancelled-in-term for a cancelled (still in term) subscription', () => {
    expect(recurlyReasons(flags({hasCanceledSubscription: true}))).toStrictEqual(
      ['cancelled-in-term']
    );
  });

  it('reports paused', () => {
    expect(recurlyReasons(flags({hasPausedSubscription: true}))).toStrictEqual([
      'paused',
    ]);
  });

  it('reports past-due', () => {
    expect(recurlyReasons(flags({hasPastDueInvoice: true}))).toStrictEqual([
      'past-due',
    ]);
  });

  it('reports future-only when a future subscription has no active one', () => {
    expect(recurlyReasons(flags({hasFutureSubscription: true}))).toStrictEqual([
      'future-only',
    ]);
  });

  it('reports expired when there is fresh data but nothing live', () => {
    expect(recurlyReasons(flags({}))).toStrictEqual(['expired']);
  });

  it('reports no-data when there is no fresh row', () => {
    expect(recurlyReasons(O.none)).toStrictEqual(['no-data']);
  });

  it('reports multiple reasons together', () => {
    expect(
      recurlyReasons(
        flags({hasCanceledSubscription: true, hasPastDueInvoice: true})
      )
    ).toStrictEqual(['cancelled-in-term', 'past-due']);
  });
});
