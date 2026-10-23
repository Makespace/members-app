import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {
  EmailAddress,
  StoredDomainEvent,
  constructEvent,
} from '../../../src/types';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import { insertEventWithOptimisticConcurrencyControl } from '../../../src/init-dependencies/event-store/insert-event-with-optimistic-concurrency-control';
import { FailureWithStatus } from '../../../src/types/failure-with-status';

type OCCReturnType = E.Either<FailureWithStatus, 'raised-event' | 'last-known-version-out-of-date'>;

const arbitaryEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

describe('insertEventWithOptimisticConcurrencyControl', () => {
  let dbClient: libsqlClient.Client;
  let getStoredEvents: () => Promise<ReadonlyArray<StoredDomainEvent>>;

  beforeEach(async () => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(dbClient)());
    getStoredEvents = async () => getRightOrFail(await getAllEvents(dbClient)()());
  });

  afterEach(() => {
    dbClient.close();
  });

  it("refuses an event that wouldn't read back, keeping the store loadable", async () => {
    // Infinity is written to JSON as null, which no event accepts.
    const event = {...arbitaryEvent(), memberNumber: Infinity};
    const result = await insertEventWithOptimisticConcurrencyControl(
      event,
      0 as t.Int,
      dbClient
    )();
    expect(E.isLeft(result)).toBe(true);
    expect(await getStoredEvents()).toHaveLength(0);
  });

  describe('inserts the first event', () => {
    const event = arbitaryEvent();
    let result: OCCReturnType;
    beforeEach(async () => {
      result = await insertEventWithOptimisticConcurrencyControl(
        event,
        0 as t.Int,
        dbClient
      )();
    });

    it('event was raised successfully', () => {
      expect(getRightOrFail(result)).toStrictEqual('raised-event');
    });

    it('event was committed', async () => {
      const storedEvents = await getStoredEvents();
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0]).toMatchObject({
        ...event,
        event_index: 1,
      });
    });

    describe('tries to insert the first event again', () => {
      let result: OCCReturnType;
      beforeEach(async () => {
        result = await insertEventWithOptimisticConcurrencyControl(
          event,
          0 as t.Int,
          dbClient,
        )();
      });
      it('event was rejected due to OCC conflict', () => {
        expect(getRightOrFail(result)).toStrictEqual('last-known-version-out-of-date');
      });
    });

    describe('insert a second event', () => {
      const event2 = arbitaryEvent();
      let result: OCCReturnType;
      beforeEach(async () => {
        result = await insertEventWithOptimisticConcurrencyControl(
          event2,
          1 as t.Int,
          dbClient,
        )();
      });
      it('event was raised successfully', () => {
        expect(getRightOrFail(result)).toStrictEqual('raised-event');
      });

      it('event was committed', async () => {
        const storedEvents = await getStoredEvents();
        expect(storedEvents).toHaveLength(2);
        expect(storedEvents[1]).toMatchObject({
          ...event2,
          event_index: 2,
        });
      });
    });
  });

  describe('when the database is Turso', () => {
    const failingClient = (error: Error) =>
      ({execute: () => Promise.reject(error)}) as unknown as libsqlClient.Client;

    it('treats its plain SQLITE_CONSTRAINT as someone else committing first', async () => {
      const turso = Object.assign(new Error('UNIQUE constraint failed'), {
        code: 'SQLITE_CONSTRAINT',
      });
      const result = await insertEventWithOptimisticConcurrencyControl(
        arbitaryEvent(),
        0 as t.Int,
        failingClient(turso)
      )();
      expect(getRightOrFail(result)).toStrictEqual(
        'last-known-version-out-of-date'
      );
    });

    it('reports any other failure with what went wrong', async () => {
      const outage = Object.assign(new Error('fetch failed'), {
        code: 'SERVER_ERROR',
      });
      const result = await insertEventWithOptimisticConcurrencyControl(
        arbitaryEvent(),
        0 as t.Int,
        failingClient(outage)
      )();
      expect(E.isLeft(result) && result.left).toMatchObject({
        message: 'Failed to insert event into database',
        payload: {name: 'Error', message: 'fetch failed', code: 'SERVER_ERROR'},
      });
    });
  });
});
