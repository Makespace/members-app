import {faker} from '@faker-js/faker';
import {getAll} from '../../../src/read-models/areas/get-all';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';

describe('get-all', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when no owners have been added', () => {
    beforeEach(async () => {
      await framework.commands.area.create({
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
        description: faker.company.buzzPhrase(),
      });
      events = await framework.getAllEvents();
    });

    it('returns no owners', () => {
      const areas = getAll(events);
      expect(areas[0].owners).toStrictEqual([]);
    });
  });

  describe('when owners have been added', () => {
    it.todo('returns the owners');
  });
});
