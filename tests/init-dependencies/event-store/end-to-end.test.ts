import {faker} from '@faker-js/faker';
import * as libsqlClient from '@libsql/client';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import {DomainEvent, EmailAddress, constructEvent} from '../../../src/types';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';
import {pipe} from 'fp-ts/lib/function';
import {commitEvent} from '../../../src/init-dependencies/event-store/commit-event';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {getRightOrFail} from '../../helpers';
import {Dependencies} from '../../../src/dependencies';
import {getResourceEvents} from '../../../src/init-dependencies/event-store/get-resource-events';
import {RightOfTaskEither} from '../../type-optics';
import {randomUUID} from 'crypto';

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
    let dbClient: libsqlClient.Client;
    let getTestEvents: () => Promise<ReadonlyArray<DomainEvent>>;
    let resourceEvents: RightOfTaskEither<
      ReturnType<Dependencies['getResourceEvents']>
    >;

    beforeEach(async () => {
      dbClient = libsqlClient.createClient({
        url: `file:/tmp/${randomUUID()}.db`,
      });
      await ensureEventTableExists(dbClient)();
      getTestEvents = () =>
        pipe(getAllEvents(dbClient)(), T.map(getRightOrFail))();
      resourceEvents = await pipe(
        {id: faker.string.alphanumeric(), type: faker.string.alphanumeric()},
        getResourceEvents(dbClient),
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
        await commitEvent(dbClient)(resource, initialVersion)(event)();
        resourceEvents = await pipe(
          resource,
          getResourceEvents(dbClient),
          T.map(getRightOrFail)
        )();
      });

      it('persists the event', async () => {
        expect(await getTestEvents()).toStrictEqual([event]);
      });

      it('uses the passed in version', () => {
        expect(resourceEvents.version).toStrictEqual(initialVersion);
      });
    });

    describe('committing when then last known version is up to date', () => {
      let resourceEvents: RightOfTaskEither<
        ReturnType<Dependencies['getResourceEvents']>
      >;
      const event2 = arbitraryMemberNumberLinkedToEmaiEvent();

      beforeEach(async () => {
        await commitEvent(dbClient)(resource, initialVersion)(event)();
        await commitEvent(dbClient)(resource, initialVersion)(event2)();
        resourceEvents = await pipe(
          resource,
          getResourceEvents(dbClient),
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
      const initialEvent = arbitraryMemberNumberLinkedToEmaiEvent();
      const competingEvent = arbitraryMemberNumberLinkedToEmaiEvent();
      let result: E.Either<unknown, unknown>;
      beforeEach(async () => {
        await commitEvent(dbClient)(resource, initialVersion)(initialEvent)();
        await pipe(
          competingEvent,
          commitEvent(dbClient)(resource, initialVersion),
          T.map(getRightOrFail)
        )();
        result = await commitEvent(dbClient)(resource, initialVersion)(event)();
      });

      it('does not persist the event', async () => {
        const events = await getTestEvents();
        expect(events).toHaveLength(2);
        expect(events).toStrictEqual([initialEvent, competingEvent]);
      });

      it('returns on left', () => {
        expect(result).toStrictEqual(E.left(expect.anything()));
      });
    });
  });
});
