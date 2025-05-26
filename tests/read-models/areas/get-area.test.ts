import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {getArea} from '../../../src/read-models/areas/get-area';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';

describe('get-area', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.eventStoreDb.close();
  });

  describe('when area exists', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      events = await framework.getAllEvents();
    });

    it('returns the area', () => {
      const area = pipe(createArea.id, getArea(events), getSomeOrFail);
      expect(area.id).toStrictEqual(createArea.id);
    });
  });

  describe('when the area does not exist', () => {
    it('returns none', () => {
      expect(getArea(events)(faker.string.uuid() as UUID)).toStrictEqual(
        O.none
      );
    });
  });
});
