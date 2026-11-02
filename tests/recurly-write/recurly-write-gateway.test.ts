import pino from 'pino';
import {faker} from '@faker-js/faker';
import {
  initRecurlyWriteGateway,
  RecurlyWriteClientFactory,
  RecurlyWriteContext,
  RecurlyWriteGateway,
} from '../../src/recurly-write/recurly-write-gateway';
import {getLeftOrFail, getRightOrFail, userActor} from '../helpers';

const silentLogger = pino({level: 'silent'});

describe('recurly write gateway', () => {
  const subscriptionId = faker.string.alphanumeric(12);
  let context: RecurlyWriteContext;
  let client: {
    pauseSubscription: jest.Mock;
    resumeSubscription: jest.Mock;
    cancelSubscription: jest.Mock;
  };
  let createClient: jest.Mock;

  beforeEach(() => {
    context = {actor: userActor(), reason: 'member asked to pause'};
    client = {
      pauseSubscription: jest.fn().mockResolvedValue({}),
      resumeSubscription: jest.fn().mockResolvedValue({}),
      cancelSubscription: jest.fn().mockResolvedValue({}),
    };
    createClient = jest.fn().mockReturnValue(client);
  });

  const initGateway = (token: string | undefined): RecurlyWriteGateway =>
    initRecurlyWriteGateway(
      silentLogger,
      token,
      createClient as RecurlyWriteClientFactory
    );

  describe('when no write token is configured', () => {
    let gateway: RecurlyWriteGateway;

    beforeEach(() => {
      gateway = initGateway(undefined);
    });

    it('refuses to pause without contacting Recurly', async () => {
      const failure = getLeftOrFail(
        await gateway.pauseSubscription(subscriptionId, 1, context)()
      );
      expect(failure.message).toContain('not enabled');
      expect(createClient).not.toHaveBeenCalled();
    });

    it('refuses to resume without contacting Recurly', async () => {
      getLeftOrFail(await gateway.resumeSubscription(subscriptionId, context)());
      expect(createClient).not.toHaveBeenCalled();
    });

    it('refuses to cancel without contacting Recurly', async () => {
      getLeftOrFail(
        await gateway.cancelSubscriptionAtTermEnd(subscriptionId, context)()
      );
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  describe('when a write token is configured', () => {
    let gateway: RecurlyWriteGateway;

    beforeEach(() => {
      gateway = initGateway('write-token');
    });

    it('creates its client with the write token', () => {
      expect(createClient).toHaveBeenCalledWith('write-token');
    });

    it('pauses the subscription for the given number of billing cycles', async () => {
      getRightOrFail(await gateway.pauseSubscription(subscriptionId, 2, context)());
      expect(client.pauseSubscription).toHaveBeenCalledWith(subscriptionId, {
        remainingPauseCycles: 2,
      });
    });

    it('resumes the subscription', async () => {
      getRightOrFail(await gateway.resumeSubscription(subscriptionId, context)());
      expect(client.resumeSubscription).toHaveBeenCalledWith(subscriptionId);
    });

    it('cancels at the end of the paid-for term rather than immediately', async () => {
      getRightOrFail(
        await gateway.cancelSubscriptionAtTermEnd(subscriptionId, context)()
      );
      expect(client.cancelSubscription).toHaveBeenCalledWith(subscriptionId, {
        body: {timeframe: 'term_end'},
      });
    });

    describe('and Recurly rejects the write', () => {
      beforeEach(() => {
        client.pauseSubscription.mockRejectedValue(new Error('boom'));
      });

      it('reports a failure instead of throwing', async () => {
        const failure = getLeftOrFail(
          await gateway.pauseSubscription(subscriptionId, 1, context)()
        );
        expect(failure.message).toBe('Recurly pauseSubscription failed');
      });
    });
  });

  describe('logging', () => {
    let logged: Array<Record<string, unknown>>;
    let gateway: RecurlyWriteGateway;

    beforeEach(() => {
      logged = [];
      const logger = pino(
        {level: 'info'},
        {write: (line: string) => logged.push(JSON.parse(line) as Record<string, unknown>)}
      );
      gateway = initRecurlyWriteGateway(
        logger,
        'write-token',
        createClient as RecurlyWriteClientFactory
      );
    });

    it('records who asked for the write, and why, before calling Recurly', async () => {
      client.resumeSubscription.mockImplementation(() => {
        expect(logged).toHaveLength(1);
        return Promise.resolve({});
      });
      getRightOrFail(await gateway.resumeSubscription(subscriptionId, context)());
      expect(logged[0]).toMatchObject({
        msg: 'Writing to Recurly',
        recurlyWrite: {
          operation: 'resumeSubscription',
          subscriptionId,
          reason: 'member asked to pause',
        },
      });
    });
  });
});
