import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {isOwner} from '../../../src/read-models/areas/is-owner';

describe('isOwner', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
  };
  const addOwner = {areaId: createArea.id, memberNumber: faker.number.int()};

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create(createArea);
    await framework.commands.area.addOwner(addOwner);
    events = await framework.getAllEvents();
  });

  describe('when user is an owner of the area', () => {
    it('returns true', () => {
      expect(isOwner(events)(createArea.id, addOwner.memberNumber)).toBe(true);
    });
  });

  describe('when user is not an owner of the area', () => {
    it.failing('returns false', () => {
      expect(isOwner(events)(createArea.id, faker.number.int())).toBe(false);
    });
  });
});
