import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {lookupByEmail} from '../../../../src/queries/members/lookup-by-email';
import {faker} from '@faker-js/faker';
import {getAllEvents} from '../../../../src/init-dependencies/event-store/get-all-events';
import {initQueryEventsDatabase} from '../../../../src/init-dependencies/event-store/init-events-database';
import {QueryEventsDatabase} from '../../../../src/init-dependencies/event-store/query-events-database';
import {ensureEventTableExists} from '../../../../src/init-dependencies/event-store/ensure-event-table-exists';
import {DomainEvent} from '../../../../src/types';
import {shouldNotBeCalled} from '../../../should-not-be-called.helper';
import {pipe} from 'fp-ts/lib/function';

describe('lookupByEmail', () => {
  let queryEventsDatabase: QueryEventsDatabase;
  let events: ReadonlyArray<DomainEvent>;
  beforeEach(async () => {
    queryEventsDatabase = initQueryEventsDatabase();
    await ensureEventTableExists(queryEventsDatabase)();
  });

  describe('when no members exist', () => {
    beforeEach(async () => {
      events = await pipe(
        getAllEvents(queryEventsDatabase)(),
        TE.getOrElse(shouldNotBeCalled)
      )();
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
