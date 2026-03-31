import createLogger from 'pino';
import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import * as T from 'fp-ts/Task';
import {randomUUID} from 'crypto';
import {
  DomainEvent,
  EmailAddress,
  StoredDomainEvent,
  constructEvent,
} from '../../../src/types';
import {commitEvent} from '../../../src/init-dependencies/event-store/commit-event';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {
  getAllEvents,
  getAllEventsAfterEventIndex,
  getAllEventsByType,
  getAllEventsByTypes,
} from '../../../src/init-dependencies/event-store/get-all-events';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {UUID} from 'io-ts-types';
import {EventName} from '../../../src/types/domain-event';

const arbitraryMemberNumberLinkedToEmailEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

const arbitraryEquipmentTrainingSheetRegisteredEvent = () =>
  constructEvent('EquipmentTrainingSheetRegistered')({
    equipmentId: faker.string.uuid() as UUID,
    trainingSheetId: faker.string.alphanumeric(12),
    actor: arbitraryActor(),
  });

const arbitraryEquipmentTrainingQuizResultEvent = () =>
  constructEvent('EquipmentTrainingQuizResult')({
    actor: arbitraryActor(),
  });

const arbitraryResource = () => ({
  id: randomUUID(),
  type: 'test-resource',
});

describe('get all events', () => {
  const testLogger = createLogger({level: 'silent'});
  const dummyRefreshReadModel = () => T.of(undefined);

  const expectStoredEvent = (
    actualEvent: StoredDomainEvent,
    expectedEvent: DomainEvent,
    expectedIndex: number
  ) => {
    expect(actualEvent).toMatchObject(expectedEvent);
    expect(actualEvent.event_index).toStrictEqual(expectedIndex);
    expect(actualEvent.event_id).toEqual(expect.any(String));
  };

  let dbClient: libsqlClient.Client;
  let persistEvent: (event: DomainEvent) => Promise<void>;
  let initalisedGetAllEvents: () => Promise<ReadonlyArray<StoredDomainEvent>>;
  let initalisedGetAllEventsAfterEventIndex: (
    eventIndex: number
  ) => Promise<ReadonlyArray<StoredDomainEvent>>;
  let initalisedGetAllEventsByType: (
    type: EventName
  ) => Promise<ReadonlyArray<StoredDomainEvent>>;
  let initalisedGetAllEventsByTypes: (
    type1: EventName,
    type2: EventName
  ) => Promise<ReadonlyArray<StoredDomainEvent>>;

  beforeEach(async () => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(dbClient)());
    persistEvent = async (event: DomainEvent) => {
      getRightOrFail(
        await commitEvent(
          dbClient,
          testLogger,
          dummyRefreshReadModel
        )(arbitraryResource(), 'no-such-resource')(event)()
      )
    };
    initalisedGetAllEvents = async () =>
      getRightOrFail(await getAllEvents(dbClient)()());
    initalisedGetAllEventsAfterEventIndex = async (eventIndex: number) =>
      getRightOrFail(await getAllEventsAfterEventIndex(dbClient)(eventIndex)());
    initalisedGetAllEventsByType = async (type: EventName) =>
      getRightOrFail(await getAllEventsByType(dbClient)(type)());
    initalisedGetAllEventsByTypes = async (
      type1: EventName,
      type2: EventName
    ) => getRightOrFail(await getAllEventsByTypes(dbClient)(type1, type2)());
  });

  afterEach(() => {
    dbClient.close();
  });

  describe('getAllEvents', () => {
    it('returns all persisted events except EquipmentTrainingQuizResult', async () => {
      const memberNumberLinkedToEmail =
        arbitraryMemberNumberLinkedToEmailEvent();
      const equipmentTrainingQuizResult =
        arbitraryEquipmentTrainingQuizResultEvent();
      const equipmentTrainingSheetRegistered =
        arbitraryEquipmentTrainingSheetRegisteredEvent();
      await persistEvent(memberNumberLinkedToEmail);
      await persistEvent(equipmentTrainingQuizResult);
      await persistEvent(equipmentTrainingSheetRegistered);
      const events = await initalisedGetAllEvents();
      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], memberNumberLinkedToEmail, 1);
      expectStoredEvent(events[1], equipmentTrainingSheetRegistered, 3);
    });
  });

  describe('getAllEventsAfterEventIndex', () => {
    it('returns only events after the given event index', async () => {
      const event1 = arbitraryMemberNumberLinkedToEmailEvent();
      const event2 = arbitraryMemberNumberLinkedToEmailEvent();
      const event3 = arbitraryMemberNumberLinkedToEmailEvent();

      await persistEvent(event1);
      await persistEvent(event2);
      await persistEvent(event3);

      const events = await initalisedGetAllEventsAfterEventIndex(1);

      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], event2, 2);
      expectStoredEvent(events[1], event3, 3);
    });

    it('returns only visible events after the given event index', async () => {
      const event1 = arbitraryMemberNumberLinkedToEmailEvent();
      const hiddenEvent = arbitraryEquipmentTrainingQuizResultEvent();
      const event3 = arbitraryEquipmentTrainingSheetRegisteredEvent();

      await persistEvent(event1);
      await persistEvent(hiddenEvent);
      await persistEvent(event3);

      const events = await initalisedGetAllEventsAfterEventIndex(1);

      expect(events).toHaveLength(1);
      expectStoredEvent(events[0], event3, 3);
    });
  });

  describe('getAllEventsByType', () => {
    it('returns only events of the requested type', async () => {
      const firstMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();
      const nonMatchingEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();
      const secondMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();
      await persistEvent(firstMatchingEvent);
      await persistEvent(nonMatchingEvent);
      await persistEvent(secondMatchingEvent);
      const events = await initalisedGetAllEventsByType(
        'MemberNumberLinkedToEmail'
      );
      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], firstMatchingEvent, 1);
      expectStoredEvent(events[1], secondMatchingEvent, 3);
    });

    it('returns EquipmentTrainingQuizResult events when explicitly requested', async () => {
      const equipmentTrainingQuizResult =
        arbitraryEquipmentTrainingQuizResultEvent();
      const nonMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();
      await persistEvent(equipmentTrainingQuizResult);
      await persistEvent(nonMatchingEvent);
      const events = await initalisedGetAllEventsByType(
        'EquipmentTrainingQuizResult'
      );
      expect(events).toHaveLength(1);
      expectStoredEvent(events[0], equipmentTrainingQuizResult, 1);
    });
  });

  describe('getAllEventsByTypes', () => {
    it('returns events matching either requested type', async () => {
      const firstMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();
      const nonMatchingEvent = arbitraryEquipmentTrainingQuizResultEvent();
      const secondMatchingEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();

      await persistEvent(firstMatchingEvent);
      await persistEvent(nonMatchingEvent);
      await persistEvent(secondMatchingEvent);

      const events = await initalisedGetAllEventsByTypes(
        'MemberNumberLinkedToEmail',
        'EquipmentTrainingSheetRegistered'
      );
      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], firstMatchingEvent, 1);
      expectStoredEvent(events[1], secondMatchingEvent, 3);
    });

    it('returns EquipmentTrainingQuizResult events when one of the requested types matches', async () => {
      const equipmentTrainingQuizResult =
        arbitraryEquipmentTrainingQuizResultEvent();
      const matchingEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();
      const nonMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();

      await persistEvent(equipmentTrainingQuizResult);
      await persistEvent(matchingEvent);
      await persistEvent(nonMatchingEvent);

      const events = await initalisedGetAllEventsByTypes(
        'EquipmentTrainingQuizResult',
        'EquipmentTrainingSheetRegistered'
      );
      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], equipmentTrainingQuizResult, 1);
      expectStoredEvent(events[1], matchingEvent, 2);
    });
  });
});
