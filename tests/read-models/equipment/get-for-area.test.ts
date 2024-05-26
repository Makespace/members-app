import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {getForArea} from '../../../src/read-models/equipment/get-for-area';

describe('get-for-area', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when area exists and contains equipment', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      description: faker.company.buzzPhrase(),
    };
    const addEquipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      events = await framework.getAllEvents();
    });

    it('returns the equipment', () => {
      const areaEquipment = getForArea(events)(createArea.id);
      expect(areaEquipment[0].id).toStrictEqual(addEquipment.id);
    });
  });
});
