import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {EmailAddress} from '../../../src/types/email-address';
import {getRecurlyStatusForMember} from '../../../src/read-models/external-state/recurly-status';
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
});
