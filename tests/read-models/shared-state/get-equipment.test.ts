import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../../helpers';

import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';

describe('get', () => {
  let framework: TestFramework;
  const equipmentId = faker.string.uuid() as UUID;
  const runQuery = () =>
    pipe(equipmentId, framework.sharedReadModel.equipment.get, getSomeOrFail);

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when equipment has a trainer and trained users', () => {
    const addTrainerMember = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
    };
    const addTrainedMember = {
      memberNumber: faker.number.int() as Int,
      email: faker.internet.email() as EmailAddress,
    };
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
      memberNumber: addTrainerMember.memberNumber,
      equipmentId: equipmentId,
    };
    const markTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.trainers.markTrained(markTrained);
    });

    it('returns the equipment', () => {
      const equipment = runQuery();
      expect(equipment.id).toStrictEqual(addEquipment.id);
    });

    it('returns the trainer', () => {
      const equipment = runQuery();
      expect(equipment.trainers).toHaveLength(1);
      expect(equipment.trainers[0].memberNumber).toStrictEqual(
        addTrainer.memberNumber
      );
    });

    it('returns the trained users', () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(1);
      expect(equipment.trainedMembers[0].memberNumber).toStrictEqual(
        markTrained.memberNumber
      );
    });

    it('returns the area it belongs to', () => {
      const equipment = runQuery();
      expect(equipment.area.id).toStrictEqual(createArea.id);
      expect(equipment.area.name).toStrictEqual(createArea.name);
    });
  });

  describe('When equipment has a member marked as trained twice', () => {
    const addTrainedMember = {
      memberNumber: faker.number.int() as Int,
      email: faker.internet.email() as EmailAddress,
    };
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment = {
      id: equipmentId,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const markTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.markTrained(markTrained);
      await framework.commands.trainers.markTrained(markTrained);
    });

    it('equipment only shows member as trained once', () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(1);
    });
  });

  describe('When equipment has a member marked as trained then revoked', () => {
    const addTrainedMember = {
      memberNumber: faker.number.int() as Int,
      email: faker.internet.email() as EmailAddress,
    };
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment = {
      id: equipmentId,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const markTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };
    const revokeTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.markTrained(markTrained);
      await framework.commands.trainers.revokeTrained(revokeTrained);
    });

    it("equipment doesn't show the member as trained", () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(0);
    });

    describe('Member is then re-trained', () => {
      beforeEach(async () => {
        await framework.commands.trainers.markTrained(markTrained);
      });

      it('Equipment shows the member as trained again', () => {
        const equipment = runQuery();
        expect(equipment.trainedMembers).toHaveLength(1);
      });
    });
  });
});
