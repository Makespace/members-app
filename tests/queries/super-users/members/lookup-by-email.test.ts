import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {lookupByEmail} from '../../../../src/queries/members/lookup-by-email';
import {faker} from '@faker-js/faker';
import {getAllEvents} from '../../../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../../../src/init-dependencies/event-store/init-events-database';
import {ensureEventTableExists} from '../../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {DomainEvent} from '../../../../src/types';
import {shouldNotBeCalled} from '../../../should-not-be-called.helper';
import {pipe} from 'fp-ts/lib/function';

type TestFramework = {
  getAllEvents: () => Promise<ReadonlyArray<DomainEvent>>;
};

const initTestFramework = async (): Promise<TestFramework> => {
  const queryEventsDatabase = initQueryEventsDatabase();
  await ensureEventTableExists(queryEventsDatabase)();

  return {
    getAllEvents: () =>
      pipe(
        getAllEvents(queryEventsDatabase)(),
        TE.getOrElse(shouldNotBeCalled)
      )(),
  };
};

describe('lookupByEmail', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when no members exist', () => {
    beforeEach(async () => {
      events = await framework.getAllEvents();
    });
    const result = lookupByEmail(faker.internet.email())(events);

    it('returns none', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when a member with the given email exists', () => {
    it.todo('returns their member number');
  });

  describe('when no member with the given email exists', () => {
    it.todo('returns none');
  });
});
