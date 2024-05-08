import {faker} from '@faker-js/faker';
import {Dependencies} from '../../../src/dependencies';
import {ensureEventTableExists} from '../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {initQueryEventsDatabase} from '../../../src/init-dependencies/event-store/init-events-database';
import {constructEvent} from '../../../src/types';
import {UUID} from 'io-ts-types';
import {commitEvent} from '../../../src/init-dependencies/event-store/commit-event';
import {getAllEvents} from '../../../src/init-dependencies/event-store/get-all-events';

describe('event-store end-to-end', () => {
  describe('commit event on an empty store', () => {
    const queryEventsDatabase = initQueryEventsDatabase();
    let deps: Pick<Dependencies, 'commitEvent'> &
      Pick<Dependencies, 'getAllEvents'>;

    const event = constructEvent('AreaCreated')({
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun(),
      description: faker.string.alphanumeric(),
    });

    beforeEach(async () => {
      deps = {
        commitEvent: commitEvent(queryEventsDatabase),
        getAllEvents: getAllEvents(queryEventsDatabase),
      };
      await ensureEventTableExists(queryEventsDatabase)();
      deps.commitEvent(event);
    });

    it.failing('persists and returns the event', async () => {
      expect(await deps.getAllEvents()()).toStrictEqual([event]);
    });
  });
});
