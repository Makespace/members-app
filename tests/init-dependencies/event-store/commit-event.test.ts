import {faker} from '@faker-js/faker';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import {DomainEvent, EmailAddress, constructEvent} from '../../../src/types';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../../src/init-dependencies/event-store/init-events-database';
import {pipe} from 'fp-ts/lib/function';
import {commitEvent} from '../../../src/init-dependencies/event-store/commit-event';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {getRightOrFail} from '../../helpers';
import {QueryEventsDatabase} from '../../../src/init-dependencies/event-store/query-events-database';

const arbitraryMemberNumberLinkedToEmaiEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
  });

describe('commit-event', () => {
  const event = arbitraryMemberNumberLinkedToEmaiEvent();
  let queryDatabase: QueryEventsDatabase;
  let getTestEvents: () => Promise<ReadonlyArray<DomainEvent>>;
  beforeEach(async () => {
    queryDatabase = initQueryEventsDatabase();
    await ensureEventTableExists(queryDatabase)();
    getTestEvents = () =>
      pipe(getAllEvents(queryDatabase)(), T.map(getRightOrFail))();
  });

  describe('when the last known version is the latest persisted version', () => {
    beforeEach(async () => {
      await commitEvent(queryDatabase)('MemberNumberEmailPairings', 1)(event)();
    });

    it('persists the event', async () => {
      expect(await getTestEvents()).toStrictEqual([event]);
    });
  });

  describe('when the last known version is out of date', () => {
    const competingEvent = arbitraryMemberNumberLinkedToEmaiEvent();
    let result: E.Either<unknown, unknown>;
    beforeEach(async () => {
      await commitEvent(queryDatabase)('MemberNumberEmailPairings', 1)(
        competingEvent
      )();
      result = await commitEvent(queryDatabase)('MemberNumberEmailPairings', 1)(
        event
      )();
    });

    it.failing('does not persist the event', async () => {
      expect(await getTestEvents()).toStrictEqual([competingEvent]);
    });

    it.failing('returns on left', () => {
      expect(result).toStrictEqual(E.left(expect.anything()));
    });
  });
});
