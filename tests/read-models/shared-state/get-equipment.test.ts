import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../../helpers';
import {Int} from 'io-ts';

describe('get', () => {
  let framework: TestFramework;
  const equipmentId = faker.string.uuid() as UUID;
  const runQuery = async () => {
    const events = await framework.getAllEvents();
    framework.sharedReadModel.refresh(events);
    return pipe(
      equipmentId,
      framework.sharedReadModel.equipment.get,
      getSomeOrFail
    );
  };
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when equipment has a trainer and trained users', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment = {
      id: equipmentId,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const addTrainer = {
      memberNumber: faker.number.int(),
      equipmentId: equipmentId,
    };
    const markTrained = {
      equipmentId: equipmentId,
      memberNumber: faker.number.int() as Int,
    };
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.trainers.markTrained(markTrained);
    });

    it.failing('returns the equipment', async () => {
      const equipment = await runQuery();
      expect(equipment.id).toStrictEqual(addEquipment.id);
    });

    // it('returns the trainer', async () => {
    //   const equipment = await runQuery();
    //   expect(equipment.trainers[0]).toStrictEqual(addTrainer.memberNumber);
    // });

    // it('returns the trained users', () => {
    //   const equipment = await runQuery();
    //   expect(equipment.trainedMembers).toHaveLength(1);
    //   expect(equipment.trainedMembers[0]).toStrictEqual(
    //     markTrained.memberNumber
    //   );
    // });
  });
});
