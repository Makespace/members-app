import {faker} from '@faker-js/faker';
import * as T from 'fp-ts/Task';
import {DomainEvent, EmailAddress, constructEvent} from '../../src/types';
import {getAllEvents} from '../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../src/init-dependencies/event-store/init-events-database';
import {pipe} from 'fp-ts/lib/function';
import {commitEvent} from '../../src/init-dependencies/event-store/commit-event';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-event-table-exists';
import {getRightOrFail} from '../helpers';

describe('commit-event', () => {
  describe('when the last known version is the latest persisted version', () => {
    const event = constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    });

    let events: ReadonlyArray<DomainEvent>;
    beforeEach(async () => {
      const queryDatabase = initQueryEventsDatabase();
      await ensureEventTableExists(queryDatabase)();
      await commitEvent(queryDatabase)('MemberNumberEmailPairings', 1)(event)();
      events = await pipe(
        getAllEvents(queryDatabase)(),
        T.map(getRightOrFail)
      )();
    });

    it('persists the event', () => {
      expect(events).toStrictEqual([event]);
    });
  });

  describe('when the last known version is out of date', () => {
    it.todo('persists the event');
  });
});
