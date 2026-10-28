import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {advanceTo, clear} from 'jest-date-mock';
import {notifyRecurlyActivity} from '../../src/sync-worker/notify_recurly_activity';
import {
  recurlyAccountCodeTable,
  recurlySubscriptionHistoryTable,
  recurlySyncMetadataTable,
  recurlyTransactionTable,
} from '../../src/sync-worker/recurly/recurly-data-table';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {arbitraryUser} from '../types/user.helper';

type Sent = {recipient: string; subject: string; text: string};

describe('notifyRecurlyActivity', () => {
  let framework: TestFramework;
  let sent: Array<Sent>;
  const managementAreaId = faker.string.uuid() as UUID;
  const manager = arbitraryUser();
  const otherMember = arbitraryUser();

  const conf = (overrides: Record<string, unknown> = {}) => ({
    PUBLIC_URL: 'http://localhost:8080',
    RECURLY_TOKEN: 'read-only-token',
    MANAGEMENT_TEAM_AREA_ID: managementAreaId,
    TROUBLE_TICKET_NOTIFY_TO: 'all',
    RECURLY_ALERT_BLOCKED_THRESHOLD: 10,
    RECURLY_ALERT_WINDOW_HOURS: 24,
    ...overrides,
  });

  const run = (at: string, overrides: Record<string, unknown> = {}) => {
    advanceTo(new Date(at));
    return notifyRecurlyActivity(
      {
        ...framework.depsForCommands,
        conf: conf(overrides),
        sendEmail: (email: Sent) => () =>
          Promise.resolve(
            (sent.push({recipient: email.recipient, subject: email.subject, text: email.text}),
            {_tag: 'Right' as const, right: 'ok'})
          ),
      } as unknown as Parameters<typeof notifyRecurlyActivity>[0],
      new Date(at)
    );
  };

  const transaction = (
    at: string,
    fields: Partial<typeof recurlyTransactionTable.$inferInsert> = {}
  ) =>
    framework.depsForCommands.extDB
      .insert(recurlyTransactionTable)
      .values({
        id: faker.string.uuid(),
        type: 'purchase',
        status: 'success',
        amount: 40,
        currency: 'GBP',
        origin: 'recurring',
        createdAt: new Date(at),
        cachedAt: new Date(at),
        ...fields,
      })
      .run();

  const blocked = async (n: number, at: string) => {
    for (let i = 0; i < n; i++) {
      await transaction(at, {
        status: 'declined',
        statusCode: 'fraud_gateway',
        origin: 'hpp',
        amount: 33.33,
        ipAddressCountry: 'US',
        billingCountry: 'US',
      });
    }
  };

  const markTransactionsSynced = () =>
    framework.depsForCommands.extDB
      .insert(recurlySyncMetadataTable)
      .values({resource: 'transactions', cursor: new Date('2026-11-01T00:00:00Z')})
      .run();

  beforeEach(async () => {
    sent = [];
    framework = await initTestFramework();
    for (const member of [manager, otherMember]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: managementAreaId,
      name: 'Management Team' as NonEmptyString,
    });
    await framework.commands.area.addOwner({
      areaId: managementAreaId,
      memberNumber: manager.memberNumber,
    });
  });

  afterEach(() => {
    clear();
    framework.close();
  });

  // Wednesday 4 Nov 2026, mid-week, so no weekly summary is due unless a test
  // asks for one.
  const midWeek = '2026-11-04T12:00:00.000Z';

  describe('suspicious activity alerts', () => {
    beforeEach(async () => {
      // This week's summary has already gone, so only alerts are in play.
      await markTransactionsSynced();
      await run('2026-11-02T09:30:00.000Z');
      sent = [];
    });

    it('stays quiet below the threshold', async () => {
      await blocked(9, '2026-11-04T08:00:00.000Z');
      await run(midWeek);
      expect(sent).toStrictEqual([]);
    });

    describe('when blocked payments reach the threshold within the window', () => {
      beforeEach(async () => {
        await blocked(12, '2026-11-04T08:00:00.000Z');
        await run(midWeek);
      });

      it('emails the management team, and nobody else', () => {
        expect(sent.map(email => email.recipient)).toStrictEqual([manager.emailAddress]);
      });

      it('says how many payments were blocked, and where from', () => {
        expect(sent[0].subject).toBe('Unusual activity on Recurly: 12 blocked payments in 24 hours');
        expect(sent[0].text).toContain('…through the signup page: 12');
        expect(sent[0].text).toContain('US 12');
      });

      it('does not email again while the window since the last alert is open', async () => {
        await blocked(30, '2026-11-04T20:00:00.000Z');
        await run('2026-11-04T21:00:00.000Z');
        expect(sent).toHaveLength(1);
      });

      it('alerts again once a full window has passed, if it is still going on', async () => {
        await blocked(15, '2026-11-05T11:00:00.000Z');
        await run('2026-11-05T12:30:00.000Z');
        expect(sent).toHaveLength(2);
      });
    });

    it('does not count ordinary declines as blocked', async () => {
      for (let i = 0; i < 15; i++) {
        await transaction('2026-11-04T08:00:00.000Z', {
          status: 'declined',
          statusCode: 'insufficient_funds',
        });
      }
      await run(midWeek);
      expect(sent).toStrictEqual([]);
    });

    it('does not count blocked payments from before the window', async () => {
      await blocked(20, '2026-11-03T10:00:00.000Z');
      await run(midWeek);
      expect(sent).toStrictEqual([]);
    });

    it('uses the configured threshold', async () => {
      await blocked(3, '2026-11-04T08:00:00.000Z');
      await run(midWeek, {RECURLY_ALERT_BLOCKED_THRESHOLD: 3});
      expect(sent).toHaveLength(1);
    });

    it('holds the email back when notifications are not switched on', async () => {
      await blocked(12, '2026-11-04T08:00:00.000Z');
      await run(midWeek, {TROUBLE_TICKET_NOTIFY_TO: ''});
      expect(sent).toStrictEqual([]);
    });

    it('tells the super users when there is no management team set up', async () => {
      await framework.commands.superUser.declare({memberNumber: otherMember.memberNumber});
      await blocked(12, '2026-11-04T08:00:00.000Z');
      await run(midWeek, {MANAGEMENT_TEAM_AREA_ID: ''});
      expect(sent.map(email => email.recipient)).toStrictEqual([otherMember.emailAddress]);
    });
  });

  describe('weekly summary', () => {
    beforeEach(async () => {
      await markTransactionsSynced();
      // The week Mon 2 Nov 09:00 to Mon 9 Nov 09:00, UK time (GMT).
      await transaction('2026-11-03T10:00:00.000Z');
      await transaction('2026-11-03T11:00:00.000Z');
      await transaction('2026-11-04T10:00:00.000Z', {status: 'declined', statusCode: 'insufficient_funds'});
      await blocked(2, '2026-11-05T10:00:00.000Z');
      await transaction('2026-11-06T10:00:00.000Z', {type: 'refund', amount: 33.33});
      // Outside the week, so not counted.
      await transaction('2026-11-09T10:00:00.000Z');
      await framework.depsForCommands.extDB
        .insert(recurlyAccountCodeTable)
        .values({code: 'new@example.com', email: 'new@example.com', createdAt: new Date('2026-11-03T10:00:00Z'), cacheLastUpdated: new Date()})
        .run();
      await framework.depsForCommands.extDB
        .insert(recurlySubscriptionHistoryTable)
        .values([
          {id: 's1', state: 'active', activatedAt: new Date('2026-11-03T10:00:00Z'), cachedAt: new Date()},
          {id: 's2', state: 'canceled', activatedAt: new Date('2025-01-01T10:00:00Z'), canceledAt: new Date('2026-11-07T10:00:00Z'), cachedAt: new Date()},
        ])
        .run();
    });

    describe('once the week has ended', () => {
      beforeEach(async () => {
        await run('2026-11-09T09:20:00.000Z');
      });

      it('emails the management team a summary of the week', () => {
        expect(sent.map(email => email.recipient)).toStrictEqual([manager.emailAddress]);
        expect(sent[0].subject).toBe('Recurly weekly summary: Mon 2 Nov 2026 to Mon 9 Nov 2026');
      });

      it('counts successful, failed and blocked payments, refunds, accounts and subscriptions', () => {
        const text = sent[0].text;
        expect(text).toContain('Successful payments: 2 (£80.00)');
        expect(text).toContain('Failed payments: 1');
        expect(text).toContain('Blocked payments: 2');
        expect(text).toContain('Refunds: 1 (£33.33)');
        expect(text).toContain('New accounts: 1');
        expect(text).toContain('New subscriptions: 1');
        expect(text).toContain('Cancelled subscriptions: 1');
        expect(text).toContain('not enough to look like an attack');
      });

      it('sends it only once', async () => {
        await run('2026-11-09T15:00:00.000Z');
        expect(sent).toHaveLength(1);
      });

      it('sends the next one the following week', async () => {
        await run('2026-11-16T09:20:00.000Z');
        expect(sent).toHaveLength(2);
        expect(sent[1].subject).toBe('Recurly weekly summary: Mon 9 Nov 2026 to Mon 16 Nov 2026');
      });
    });

    it('waits until the transaction cache has been filled', async () => {
      await framework.depsForCommands.extDB.delete(recurlySyncMetadataTable).run();
      await run('2026-11-09T09:20:00.000Z');
      expect(sent).toStrictEqual([]);
    });
  });

  it('does nothing without a Recurly token, rather than report a quiet week', async () => {
    await markTransactionsSynced();
    await blocked(50, '2026-11-04T08:00:00.000Z');
    await run('2026-11-09T09:20:00.000Z', {RECURLY_TOKEN: undefined});
    expect(sent).toStrictEqual([]);
  });
});
