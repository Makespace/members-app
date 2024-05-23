import {faker} from '@faker-js/faker';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import {DomainEvent, EmailAddress, constructEvent} from '../../../src/types';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../../src/init-dependencies/event-store/init-query-events-database';
import {pipe} from 'fp-ts/lib/function';
import {commitEvent} from '../../../src/init-dependencies/event-store/commit-event';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {getRightOrFail} from '../../helpers';
import {QueryEventsDatabase} from '../../../src/init-dependencies/event-store/query-events-database';
import {Dependencies} from '../../../src/dependencies';
import {getResourceEvents} from '../../../src/init-dependencies/event-store/get-resource-events';
import {RightOfTaskEither} from '../../type-optics';

const arbitraryMemberNumberLinkedToEmaiEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
  });

describe('event-store end-to-end', () => {
  describe('setup event store', () => {
    const resource = {id: 'singleton', type: 'MemberNumberEmailPairings'};
    const event = arbitraryMemberNumberLinkedToEmaiEvent();
    const initialVersion = faker.number.int();
    let queryDatabase: QueryEventsDatabase;
    let getTestEvents: () => Promise<ReadonlyArray<DomainEvent>>;
    let resourceEvents: RightOfTaskEither<
      ReturnType<Dependencies['getResourceEvents']>
    >;

    beforeEach(async () => {
      queryDatabase = initQueryEventsDatabase();
      await ensureEventTableExists(queryDatabase)();
      getTestEvents = () =>
        pipe(getAllEvents(queryDatabase)(), T.map(getRightOrFail))();
      resourceEvents = await pipe(
        {id: faker.string.alphanumeric(), type: faker.string.alphanumeric()},
        getResourceEvents(queryDatabase),
        T.map(getRightOrFail)
      )();
    });

    it('is empty', async () => {
      expect(await getTestEvents()).toStrictEqual([]);
    });

    it('the version of any resource is 0', () => {
      expect(resourceEvents.version).toStrictEqual(0);
    });

    describe('committing when then resource does not exist', () => {
      beforeEach(async () => {
        await commitEvent(queryDatabase)(resource, initialVersion)(event)();
        resourceEvents = await pipe(
          resource,
          getResourceEvents(queryDatabase),
          T.map(getRightOrFail)
        )();
      });

      it('persists the event', async () => {
        expect(await getTestEvents()).toStrictEqual([event]);
      });

      it.failing('uses the passed in version', () => {
        expect(resourceEvents.version).toStrictEqual(initialVersion);
      });
    });

    describe('committing when then last known version is up to date', () => {
      let resourceEvents: RightOfTaskEither<
        ReturnType<Dependencies['getResourceEvents']>
      >;
      const event2 = arbitraryMemberNumberLinkedToEmaiEvent();

      beforeEach(async () => {
        await commitEvent(queryDatabase)(resource, initialVersion)(event)();
        await commitEvent(queryDatabase)(resource, initialVersion)(event2)();
        resourceEvents = await pipe(
          resource,
          getResourceEvents(queryDatabase),
          T.map(getRightOrFail)
        )();
      });

      it('persists the event', async () => {
        expect(await getTestEvents()).toStrictEqual([event, event2]);
      });

      it('increments the version', () => {
        expect(resourceEvents.version).toStrictEqual(initialVersion + 1);
      });
    });

    describe('committing when the last known version is out of date', () => {
      const competingEvent = arbitraryMemberNumberLinkedToEmaiEvent();
      let result: E.Either<unknown, unknown>;
      beforeEach(async () => {
        await commitEvent(queryDatabase)(resource, 1)(competingEvent)();
        result = await commitEvent(queryDatabase)(resource, 1)(event)();
      });

      it.failing('does not persist the event', async () => {
        expect(await getTestEvents()).toStrictEqual([competingEvent]);
      });

      it.failing('returns on left', () => {
        expect(result).toStrictEqual(E.left(expect.anything()));
      });
    });
  });
});
