import createLogger from 'pino';
import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import * as T from 'fp-ts/Task';
import {randomUUID} from 'crypto';
import {
  DomainEvent,
  EmailAddress,
  constructEvent,
} from '../../../src/types';
import {commitEvent} from '../../../src/init-dependencies/event-store/commit-event';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-events-table-exists';
import {
  getAllEvents,
  getAllEventsByType,
  getAllEventsByTypes,
} from '../../../src/init-dependencies/event-store/get-all-events';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import { UUID } from 'io-ts-types';
import { EventName } from '../../../src/types/domain-event';
import { excludeEvent } from '../../../src/init-dependencies/event-store/exclude-event';

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

  let dbClient: libsqlClient.Client;
  let persistEvent: (event: DomainEvent) => Promise<void>;
  let unPersistEvent: (event_id: string, reverted_by_number: number, revert_reason: string) => Promise<void>;
  let initalisedGetAllEvents: () => Promise<ReadonlyArray<DomainEvent>>;
  let initalisedGetAllEventsByType: (type: EventName) => Promise<ReadonlyArray<DomainEvent>>;
  let initalisedGetAllEventsByTypes: (type1: EventName, type2: EventName) => Promise<ReadonlyArray<DomainEvent>>;

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
    unPersistEvent = async (
      event_id: string, reverted_by_number: number, revert_reason: string
    ) => {
      getRightOrFail(
        await excludeEvent(
          dbClient
        )(event_id, reverted_by_number, revert_reason)()
      )
    };
    initalisedGetAllEvents = async () => getRightOrFail(await getAllEvents(dbClient)()());
    initalisedGetAllEventsByType = async (type: EventName) => getRightOrFail(await getAllEventsByType(dbClient)(type)());
    initalisedGetAllEventsByTypes = async (type1: EventName, type2: EventName) => getRightOrFail(await getAllEventsByTypes(dbClient)(type1, type2)());
  });

  afterEach(() => {
    dbClient.close();
  });

  describe('getAllEvents', () => {
    const memberNumberLinkedToEmail = arbitraryMemberNumberLinkedToEmailEvent();
    const equipmentTrainingQuizResult = arbitraryEquipmentTrainingQuizResultEvent();
    const equipmentTrainingSheetRegistered = arbitraryEquipmentTrainingSheetRegisteredEvent();
    beforeEach(async () => {
      await persistEvent(memberNumberLinkedToEmail);
      await persistEvent(equipmentTrainingQuizResult);
      await persistEvent(equipmentTrainingSheetRegistered);
    });
    it('returns all persisted events except EquipmentTrainingQuizResult', async () => {
      expect(await initalisedGetAllEvents()).toStrictEqual([
        memberNumberLinkedToEmail,
        equipmentTrainingSheetRegistered,
      ]);
    });

    describe('exclude an event', () => {
      const excludedBy: number = faker.number.int();
      const excludedByReason: string = faker.company.catchPhrase();
      
      beforeEach(async () => {
        const eventId = (await dbClient.execute('SELECT id FROM events WHERE event_type = ?', [memberNumberLinkedToEmail.type])).rows[0]['id']! as string;
        await unPersistEvent(eventId, excludedBy, excludedByReason)
      });
      it('returns all persisted events except EquipmentTrainingQuizResult and the excluded event', async () => {
        expect(await initalisedGetAllEvents()).toStrictEqual([
          equipmentTrainingSheetRegistered,
        ]);
      });
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
      expect(await initalisedGetAllEventsByType('MemberNumberLinkedToEmail')).toStrictEqual([
        firstMatchingEvent,
        secondMatchingEvent,
      ]);
    });

    it('returns EquipmentTrainingQuizResult events when explicitly requested', async () => {
      const equipmentTrainingQuizResult =
        arbitraryEquipmentTrainingQuizResultEvent();
      const nonMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();
      await persistEvent(equipmentTrainingQuizResult);
      await persistEvent(nonMatchingEvent);
      expect(await initalisedGetAllEventsByType('EquipmentTrainingQuizResult')).toStrictEqual([equipmentTrainingQuizResult]);
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

      expect(
        await initalisedGetAllEventsByTypes(
          'MemberNumberLinkedToEmail',
          'EquipmentTrainingSheetRegistered'
        )
      ).toStrictEqual([
        firstMatchingEvent,
        secondMatchingEvent,
      ]);
    });

    it('returns EquipmentTrainingQuizResult events when one of the requested types matches', async () => {
      const equipmentTrainingQuizResult =
        arbitraryEquipmentTrainingQuizResultEvent();
      const matchingEvent = arbitraryEquipmentTrainingSheetRegisteredEvent();
      const nonMatchingEvent = arbitraryMemberNumberLinkedToEmailEvent();

      await persistEvent(equipmentTrainingQuizResult);
      await persistEvent(matchingEvent);
      await persistEvent(nonMatchingEvent);

      expect(
        await initalisedGetAllEventsByTypes(
          'EquipmentTrainingQuizResult',
          'EquipmentTrainingSheetRegistered'
        )
      ).toStrictEqual([
        equipmentTrainingQuizResult,
        matchingEvent,
      ]);
    });
  });
});
