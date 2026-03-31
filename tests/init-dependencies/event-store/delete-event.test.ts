import createLogger from 'pino';
import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import * as O from 'fp-ts/Option';
import * as T from 'fp-ts/Task';
import {randomUUID} from 'crypto';
import {
  DomainEvent,
  EmailAddress,
  constructEvent,
} from '../../../src/types';
import {
  commitEvent,
  initialVersionNumber,
} from '../../../src/init-dependencies/event-store/commit-event';
import {deleteEvent} from '../../../src/init-dependencies/event-store/delete-event';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {getEventById} from '../../../src/init-dependencies/event-store/get-event-by-id';
import {getDeletedEventById} from '../../../src/init-dependencies/event-store/get-deleted-events';
import {getResourceEvents} from '../../../src/init-dependencies/event-store/get-resource-events';
import {
  arbitraryActor,
  expectMatchSecondsPrecision,
  getRightOrFail,
  getSomeOrFail,
} from '../../helpers';

const arbitraryMemberNumberLinkedToEmailEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

const resource = {
  id: randomUUID(),
  type: 'test-resource',
};

describe('deleteEvent', () => {
  const testLogger = createLogger({level: 'silent'});
  const dummyRefreshReadModel = () => T.of(undefined);

  let dbClient: libsqlClient.Client;
  let persistEvent: (event: DomainEvent) => Promise<void>;

  beforeEach(async () => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(dbClient)());
    persistEvent = async (event: DomainEvent) => {
      getRightOrFail(
        await commitEvent(
          dbClient,
          testLogger,
          dummyRefreshReadModel
        )(resource, 'no-such-resource')(event)()
      );
    };
  });

  afterEach(() => {
    dbClient.close();
  });

  it('keeps the event available by id but removes it from resource state', async () => {
    const event = arbitraryMemberNumberLinkedToEmailEvent();
    await persistEvent(event);

    const resourceEvents = getRightOrFail(
      await getResourceEvents(dbClient)(resource)()
    );
    const eventId = resourceEvents.events[0].event_id;

    getRightOrFail(await deleteEvent(dbClient)(eventId, arbitraryActor(), 'cleanup')());

    const deletedEvent = getSomeOrFail(
      getRightOrFail(await getDeletedEventById(dbClient)(eventId)())
    );
    const eventById = getSomeOrFail(
      getRightOrFail(await getEventById(dbClient)(eventId)())
    );
    const stateAfterDelete = getRightOrFail(
      await getResourceEvents(dbClient)(resource)()
    );

    expect(deletedEvent.reason).toStrictEqual('cleanup');
    expect(deletedEvent.deletedBy).toStrictEqual(arbitraryActor());
    expectMatchSecondsPrecision(new Date())(deletedEvent.deletedAt);
    expect(eventById).toMatchObject(event);
    expect(stateAfterDelete.events).toStrictEqual([]);
    expect(stateAfterDelete.version).toStrictEqual(0);
  });

  it('returns none when no deletion has been recorded for the event', async () => {
    const event = arbitraryMemberNumberLinkedToEmailEvent();
    await persistEvent(event);

    const resourceEvents = getRightOrFail(
      await getResourceEvents(dbClient)(resource)()
    );

    expect(
      getRightOrFail(
        await getDeletedEventById(dbClient)(resourceEvents.events[0].event_id)()
      )
    ).toStrictEqual(O.none);
  });

  it('preserves the latest resource version when deleting the latest event', async () => {
    const firstEvent = arbitraryMemberNumberLinkedToEmailEvent();
    const secondEvent = arbitraryMemberNumberLinkedToEmailEvent();

    getRightOrFail(
      await commitEvent(
        dbClient,
        testLogger,
        dummyRefreshReadModel
      )(resource, 'no-such-resource')(firstEvent)()
    );
    getRightOrFail(
      await commitEvent(
        dbClient,
        testLogger,
        dummyRefreshReadModel
      )(resource, initialVersionNumber)(secondEvent)()
    );

    const resourceEvents = getRightOrFail(
      await getResourceEvents(dbClient)(resource)()
    );

    getRightOrFail(
      await deleteEvent(
        dbClient
      )(resourceEvents.events[1].event_id, arbitraryActor(), 'cleanup')()
    );

    const stateAfterDelete = getRightOrFail(
      await getResourceEvents(dbClient)(resource)()
    );

    expect(stateAfterDelete.events).toHaveLength(1);
    expect(stateAfterDelete.version).toStrictEqual(initialVersionNumber + 1);
  });
});
