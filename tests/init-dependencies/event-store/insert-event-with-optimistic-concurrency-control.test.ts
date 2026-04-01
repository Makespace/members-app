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

const arbitraryMemberNumberLinkedToEmailEvent = () =>
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

  describe('inserts the first event', () => {
    const event = arbitraryMemberNumberLinkedToEmailEvent();
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
      const event2 = arbitraryMemberNumberLinkedToEmailEvent();
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
});
