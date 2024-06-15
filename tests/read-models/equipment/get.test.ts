import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {get} from '../../../src/read-models/equipment/get';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../../helpers';

describe('get', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when equipment has a trainer', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const addTrainer = {
      memberNumber: faker.number.int(),
      equipmentId: addEquipment.id,
    };
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.equipmentTrainers.add(addTrainer);
      events = await framework.getAllEvents();
    });

    it('returns the equipment', () => {
      const equipment = pipe(addEquipment.id, get(events), getSomeOrFail);
      expect(equipment.id).toStrictEqual(addEquipment.id);
    });

    it('returns the trainer', () => {
      const equipment = pipe(addEquipment.id, get(events), getSomeOrFail);
      expect(equipment.trainers[0]).toStrictEqual(addTrainer.memberNumber);
    });
  });
});
