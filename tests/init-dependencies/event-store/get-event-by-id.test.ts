import createLogger from 'pino';
import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import * as O from 'fp-ts/Option';
import {randomUUID} from 'crypto';
import {
  EmailAddress,
  StoredDomainEvent,
  constructEvent,
} from '../../../src/types';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';
import {getEventById} from '../../../src/init-dependencies/event-store/get-event-by-id';
import {arbitraryActor, getRightOrFail, getSomeOrFail} from '../../helpers';
import {UUID} from 'io-ts-types';
import { pushEvents } from '../../sync-worker/util';

const arbitraryMemberNumberLinkedToEmailEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

describe('getEventById', () => {
  const testLogger = createLogger({level: 'silent'});
  let dbClient: libsqlClient.Client;
  let initialisedGetAllEvents: () => Promise<ReadonlyArray<StoredDomainEvent>>;
  let initialisedGetEventById: (
    eventId: UUID
  ) => Promise<O.Option<StoredDomainEvent>>;

  beforeEach(async () => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(dbClient)());
    initialisedGetAllEvents = async () =>
      getRightOrFail(await getAllEvents(dbClient)()());
    initialisedGetEventById = async (eventId: UUID) =>
      getRightOrFail(await getEventById(dbClient)(eventId)());
  });

  afterEach(() => {
    dbClient.close();
  });

  it('returns the persisted event for a matching id', async () => {
    const firstEvent = arbitraryMemberNumberLinkedToEmailEvent();
    const secondEvent = arbitraryMemberNumberLinkedToEmailEvent();

    await pushEvents(dbClient, testLogger, [
      firstEvent, secondEvent
    ]);

    const storedEvents = await initialisedGetAllEvents();
    const actualEvent = getSomeOrFail(
      await initialisedGetEventById(storedEvents[1].event_id)
    );

    expect(actualEvent).toMatchObject(secondEvent);
    expect(actualEvent.event_index).toStrictEqual(2);
    expect(actualEvent.event_id).toEqual(storedEvents[1].event_id);
  });

  it('returns none when no event matches the id', async () => {
    expect(
      await initialisedGetEventById(faker.string.uuid() as UUID)
    ).toStrictEqual(O.none);
  });
});
