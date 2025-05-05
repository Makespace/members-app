import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {get} from '../../../src/read-models/equipment/get';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../../helpers';
import {Int} from 'io-ts';

describe('get', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.eventStoreDb.close();
  });

  describe('when equipment has a trainer and trained users', () => {
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
    const markTrained = {
      equipmentId: addEquipment.id,
      memberNumber: faker.number.int() as Int,
    };
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.trainers.markTrained(markTrained);
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

    it('returns the trained users', () => {
      const equipment = pipe(addEquipment.id, get(events), getSomeOrFail);
      expect(equipment.trainedMembers).toHaveLength(1);
      expect(equipment.trainedMembers[0]).toStrictEqual(
        markTrained.memberNumber
      );
    });
  });
});
