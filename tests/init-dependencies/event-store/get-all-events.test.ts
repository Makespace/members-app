import createLogger from 'pino';
import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import {
  DomainEvent,
  EmailAddress,
  StoredDomainEvent,
  constructEvent,
} from '../../../src/types';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {
  getAllEvents,
  getAllEventsAfterEventIndex,
  getAllEventsByType,
  getAllEventsByTypes,
  getDeletedEvents,
} from '../../../src/init-dependencies/event-store/get-all-events';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {UUID} from 'io-ts-types';
import {EventName} from '../../../src/types/domain-event';
import { pushEvents } from '../../sync-worker/util';
import {setEventDeletedState} from '../../../src/init-dependencies/event-store/set-event-deleted-state';
import {Int} from 'io-ts';

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

describe('get all events', () => {
  const testLogger = createLogger({level: 'silent'});

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
  let initialisedGetDeletedEvents: () => Promise<
    ReadonlyArray<StoredDomainEvent & {deletedAt: Date}>
  >;

  beforeEach(async () => {
    dbClient = libsqlClient.createClient({url: ':memory:'});
    getRightOrFail(await ensureEventTableExists(dbClient)());
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
    initialisedGetDeletedEvents = async () =>
      getRightOrFail(await getDeletedEvents(dbClient)()());
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
      await pushEvents(dbClient, testLogger, [
        memberNumberLinkedToEmail,
        equipmentTrainingQuizResult,
        equipmentTrainingSheetRegistered,
      ]);
      const events = await initalisedGetAllEvents();
      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], memberNumberLinkedToEmail, 1);
      expectStoredEvent(events[1], equipmentTrainingSheetRegistered, 3);
    });

    it('does not return deleted events', async () => {
      const deletedEvent = arbitraryMemberNumberLinkedToEmailEvent();
      const visibleEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();

      await pushEvents(dbClient, testLogger, [deletedEvent, visibleEvent]);
      getRightOrFail(
        await setEventDeletedState(dbClient)(1 as Int, true)()
      );

      const events = await initalisedGetAllEvents();

      expect(events).toHaveLength(1);
      expectStoredEvent(events[0], visibleEvent, 2);
    });
  });

  describe('getAllEventsAfterEventIndex', () => {
    it('returns only events after the given event index', async () => {
      const event1 = arbitraryMemberNumberLinkedToEmailEvent();
      const event2 = arbitraryMemberNumberLinkedToEmailEvent();
      const event3 = arbitraryMemberNumberLinkedToEmailEvent();

      await pushEvents(dbClient, testLogger, [
        event1,
        event2,
        event3,
      ]);

      const events = await initalisedGetAllEventsAfterEventIndex(1);

      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], event2, 2);
      expectStoredEvent(events[1], event3, 3);
    });

    it('returns only visible events after the given event index', async () => {
      const event1 = arbitraryMemberNumberLinkedToEmailEvent();
      const hiddenEvent = arbitraryEquipmentTrainingQuizResultEvent();
      const event3 = arbitraryEquipmentTrainingSheetRegisteredEvent();

      await pushEvents(dbClient, testLogger, [
        event1,
        hiddenEvent,
        event3
      ]);

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
      await pushEvents(dbClient, testLogger, [
        firstMatchingEvent,
        nonMatchingEvent,
        secondMatchingEvent
      ]);
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
      await pushEvents(dbClient, testLogger, [
        equipmentTrainingQuizResult,
        nonMatchingEvent
      ]);
      const events = await initalisedGetAllEventsByType(
        'EquipmentTrainingQuizResult'
      );
      expect(events).toHaveLength(1);
      expectStoredEvent(events[0], equipmentTrainingQuizResult, 1);
    });

    it('does not return deleted events of the requested type', async () => {
      const deletedEvent = arbitraryMemberNumberLinkedToEmailEvent();
      const visibleEvent = arbitraryMemberNumberLinkedToEmailEvent();

      await pushEvents(dbClient, testLogger, [deletedEvent, visibleEvent]);
      getRightOrFail(
        await setEventDeletedState(dbClient)(1 as Int, true)()
      );

      const events = await initalisedGetAllEventsByType(
        'MemberNumberLinkedToEmail'
      );

      expect(events).toHaveLength(1);
      expectStoredEvent(events[0], visibleEvent, 2);
    });
  });

  describe('getAllEventsByTypes', () => {
    it('returns events matching either requested type', async () => {
      const firstMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();
      const nonMatchingEvent = arbitraryEquipmentTrainingQuizResultEvent();
      const secondMatchingEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();

      await pushEvents(dbClient, testLogger, [
        firstMatchingEvent,
        nonMatchingEvent,
        secondMatchingEvent
      ]);

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

      await pushEvents(dbClient, testLogger, [
        equipmentTrainingQuizResult,
        matchingEvent,
        nonMatchingEvent
      ]);

      const events = await initalisedGetAllEventsByTypes(
        'EquipmentTrainingQuizResult',
        'EquipmentTrainingSheetRegistered'
      );
      expect(events).toHaveLength(2);
      expectStoredEvent(events[0], equipmentTrainingQuizResult, 1);
      expectStoredEvent(events[1], matchingEvent, 2);
    });
  });

  describe('getDeletedEvents', () => {
    it('returns deleted events', async () => {
      const deletedEvent = arbitraryMemberNumberLinkedToEmailEvent();
      const visibleEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();

      await pushEvents(dbClient, testLogger, [deletedEvent, visibleEvent]);
      getRightOrFail(
        await setEventDeletedState(dbClient)(1 as Int, true)()
      );

      const events = await initialisedGetDeletedEvents();

      expect(events).toHaveLength(1);
      expectStoredEvent(events[0], deletedEvent, 1);
      expect(events[0].deletedAt).toEqual(expect.any(Date));
    });
  });
});
