import createLogger from 'pino';
import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import {
  EmailAddress,
  StoredDomainEvent,
  constructEvent,
} from '../../../src/types';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import { initialVersionNumber, insertEventWithOptimisticConcurrencyControl } from '../../../src/init-dependencies/event-store/insert-event-with-optimistic-concurrency-control';

const arbitraryMemberNumberLinkedToEmailEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

const testLogger = createLogger({level: 'silent'});

describe('insertEventWithOptimisticConcurrencyControl', () => {
  const resource = {id: 'singleton', type: 'MemberNumberEmailPairings'};

  let dbClient: libsqlClient.Client;
  let getStoredEvents: () => Promise<ReadonlyArray<StoredDomainEvent>>;
  let getResourceVersions: () => Promise<ReadonlyArray<number>>;

  beforeEach(async () => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(dbClient)());
    getStoredEvents = async () => getRightOrFail(await getAllEvents(dbClient)()());
    getResourceVersions = async () => {
      const result = await dbClient.execute(
        'SELECT resource_version FROM events ORDER BY event_index ASC'
      );
      return result.rows.map(row => row.resource_version as number);
    };
  });

  afterEach(() => {
    dbClient.close();
  });

  it('inserts an event when the resource does not exist yet', async () => {
    const event = arbitraryMemberNumberLinkedToEmailEvent();

    const result = await insertEventWithOptimisticConcurrencyControl(
      event,
      resource,
      'no-such-resource',
      dbClient,
      testLogger
    );

    const storedEvents = await getStoredEvents();
    const resourceVersions = await getResourceVersions();

    expect(result).toStrictEqual('raised-event');
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]).toMatchObject({
      ...event,
      event_index: 1,
    });
    expect(resourceVersions).toStrictEqual([initialVersionNumber]);
  });

  it('inserts an event when the last known version is current', async () => {
    const firstEvent = arbitraryMemberNumberLinkedToEmailEvent();
    const secondEvent = arbitraryMemberNumberLinkedToEmailEvent();

    await insertEventWithOptimisticConcurrencyControl(
      firstEvent,
      resource,
      'no-such-resource',
      dbClient,
      testLogger
    );

    const result = await insertEventWithOptimisticConcurrencyControl(
      secondEvent,
      resource,
      initialVersionNumber,
      dbClient,
      testLogger
    );

    const storedEvents = await getStoredEvents();
    const resourceVersions = await getResourceVersions();

    expect(result).toStrictEqual('raised-event');
    expect(storedEvents).toHaveLength(2);
    expect(storedEvents[1]).toMatchObject({
      ...secondEvent,
      event_index: 2,
    });
    expect(resourceVersions).toStrictEqual([
      initialVersionNumber,
      initialVersionNumber + 1,
    ]);
  });

  it('returns an out-of-date result when another event has already created the resource', async () => {
    const firstEvent = arbitraryMemberNumberLinkedToEmailEvent();
    const staleEvent = arbitraryMemberNumberLinkedToEmailEvent();

    await insertEventWithOptimisticConcurrencyControl(
      firstEvent,
      resource,
      'no-such-resource',
      dbClient,
      testLogger
    );

    const result = await insertEventWithOptimisticConcurrencyControl(
      staleEvent,
      resource,
      'no-such-resource',
      dbClient,
      testLogger
    );

    const storedEvents = await getStoredEvents();

    expect(result).toStrictEqual('last-known-version-out-of-date');
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0]).toMatchObject(firstEvent);
  });

  it('returns an out-of-date result when another event has already advanced the version', async () => {
    const initialEvent = arbitraryMemberNumberLinkedToEmailEvent();
    const competingEvent = arbitraryMemberNumberLinkedToEmailEvent();
    const staleEvent = arbitraryMemberNumberLinkedToEmailEvent();

    await insertEventWithOptimisticConcurrencyControl(
      initialEvent,
      resource,
      'no-such-resource',
      dbClient,
      testLogger
    );
    await insertEventWithOptimisticConcurrencyControl(
      competingEvent,
      resource,
      initialVersionNumber,
      dbClient,
      testLogger
    );

    const result = await insertEventWithOptimisticConcurrencyControl(
      staleEvent,
      resource,
      initialVersionNumber,
      dbClient,
      testLogger
    );

    const storedEvents = await getStoredEvents();

    expect(result).toStrictEqual('last-known-version-out-of-date');
    expect(storedEvents).toHaveLength(2);
    expect(storedEvents[0]).toMatchObject(initialEvent);
    expect(storedEvents[1]).toMatchObject(competingEvent);
  });
});
