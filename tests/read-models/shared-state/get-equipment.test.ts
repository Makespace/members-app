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
    name: faker.airline.airport().name as NonEmptyString,
  };
  const addEquipment = {
    id: equipmentId,
    name: faker.science.chemicalElement().name as NonEmptyString,
    areaId: createArea.id,
  };
  const addOwner = {
    memberNumber: addTrainerMember.memberNumber,
    areaId: createArea.id,
  };
  const removeOwner = {
    memberNumber: addOwner.memberNumber,
    areaId: addOwner.areaId,
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
    framework = await initTestFramework();
  });

  describe('when equipment has a trainer and trained users', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.area.addOwner(addOwner);
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

  describe('when someone was marked as trainer without being an owner', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.add(addTrainer);
    });

    it('returns that they are not an owner', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.ownerOf).toHaveLength(0);
    });

    it('returns that they are not a trainer', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainerFor).toHaveLength(0);
    });
  });

  describe('when someone was an owner and trainer but is no longer an owner', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.area.addOwner(addOwner);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.area.removeOwner(removeOwner);
    });

    it('returns that they are not an owner', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.ownerOf).toHaveLength(0);
    });

    it('returns that they are not a trainer', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainerFor).toHaveLength(0);
    });
  });

  describe('when someone was an owner and trainer in two areas but is no longer an owner in one', () => {
    const createAnotherArea = {
      id: faker.string.uuid() as UUID,
      name: faker.airline.airport().name as NonEmptyString,
    };
    const addOtherEquipment = {
      id: faker.string.uuid() as UUID,
      name: faker.science.chemicalElement().name as NonEmptyString,
      areaId: createAnotherArea.id,
    };
    const addOwnerToOtherArea = {
      memberNumber: addTrainerMember.memberNumber,
      areaId: createAnotherArea.id,
    };
    const addAsTrainerToOtherEquipment = {
      memberNumber: addTrainerMember.memberNumber,
      equipmentId: addOtherEquipment.id,
    };

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.area.addOwner(addOwner);
      await framework.commands.trainers.add(addTrainer);

      await framework.commands.area.create(createAnotherArea);
      await framework.commands.equipment.add(addOtherEquipment);
      await framework.commands.area.addOwner(addOwnerToOtherArea);
      await framework.commands.trainers.add(addAsTrainerToOtherEquipment);

      await framework.commands.area.removeOwner(removeOwner);
    });

    it('returns that they are only an owner of the other area', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.ownerOf).toHaveLength(1);
      expect(member.ownerOf[0].id).toStrictEqual(createAnotherArea.id);
    });

    it('returns that they are only a trainer of the equipment in the other area', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainerFor).toHaveLength(1);
      expect(member.trainerFor[0].equipment_id).toStrictEqual(
        addOtherEquipment.id
      );
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
    let markedTrainedTimestampStart: number;
    let markedTrainedTimestampEnd: number;
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      markedTrainedTimestampStart = Date.now();
      await framework.commands.trainers.markTrained(markTrained);
      markedTrainedTimestampEnd = Date.now();
      await framework.commands.trainers.markTrained(markTrained);
    });

    it('equipment only shows member as trained once', () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(1);
    });

    it('member only shows trained once', () => {
      const member = pipe(
        markTrained.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainedOn).toHaveLength(1);
      expect(member.trainedOn[0].id).toStrictEqual(markTrained.equipmentId);
      expect(member.trainedOn[0].name).toStrictEqual(addEquipment.name);
      expect(member.trainedOn[0].trainedAt.getTime()).toBeLessThanOrEqual(
        markedTrainedTimestampStart
      );
      expect(member.trainedOn[0].trainedAt.getTime()).toBeLessThanOrEqual(
        markedTrainedTimestampEnd
      );
    });

    it('equipment_check_test', async () => {
      const events = await framework.getAllEvents();
      console.log(events);

      const equipment = runQuery();
      console.log(equipment);
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
