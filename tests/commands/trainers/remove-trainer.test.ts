import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {applyCommand} from '../../../src/commands/apply-command';
import {
  RemoveTrainer,
  removeTrainer,
} from '../../../src/commands/trainers/remove-trainer';
import {EmailAddress} from '../../../src/types';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('removeTrainer', () => {
  let framework: TestFramework;
  let applyRemoveTrainer: ReturnType<typeof applyCommand<RemoveTrainer>>;

  const memberNumber = faker.number.int() as Int;
  const area = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
  };
  const equipment = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
    areaId: area.id,
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    applyRemoveTrainer = applyCommand(framework.depsForCommands, removeTrainer);
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create(area);
    await framework.commands.equipment.add(equipment);
    await framework.commands.area.addOwner({
      areaId: area.id,
      memberNumber,
    });
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the member is a trainer for the equipment', () => {
    beforeEach(async () => {
      await framework.commands.trainers.add({
        equipmentId: equipment.id,
        memberNumber,
      });
      await applyRemoveTrainer(
        {equipmentId: equipment.id, memberNumber},
        arbitraryActor()
      )();
    });

    it('records a TrainerRemoved event', async () => {
      const events = await framework.getAllEventsByType('TrainerRemoved');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        equipmentId: equipment.id,
        memberNumber,
      });
    });

    it('no longer lists them as a trainer', () => {
      const result = getRightOrFail(
        E.fromOption(() => 'unknown equipment')(
          framework.sharedReadModel.equipment.get(equipment.id)
        )
      );
      expect(result.trainers).toHaveLength(0);
    });
  });

  describe('when the member is not a trainer for the equipment', () => {
    it('fails and records no event', async () => {
      const result = await applyRemoveTrainer(
        {equipmentId: equipment.id, memberNumber},
        arbitraryActor()
      )();
      expect(E.isLeft(result)).toBe(true);
      const events = await framework.getAllEventsByType('TrainerRemoved');
      expect(events).toHaveLength(0);
    });
  });

  describe('when the equipment does not exist', () => {
    it('fails', async () => {
      const result = await applyRemoveTrainer(
        {
          equipmentId: faker.string.uuid() as UUID,
          memberNumber,
        },
        arbitraryActor()
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('when a rejoined trainer is removed via their old member number', () => {
    const newMemberNumber = faker.number.int({min: memberNumber + 1}) as Int;
    beforeEach(async () => {
      await framework.commands.trainers.add({
        equipmentId: equipment.id,
        memberNumber,
      });
      await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
        oldMemberNumber: memberNumber,
        newMemberNumber,
      });
      await applyRemoveTrainer(
        {equipmentId: equipment.id, memberNumber},
        arbitraryActor()
      )();
    });

    it('no longer lists them as a trainer', () => {
      const result = getRightOrFail(
        E.fromOption(() => 'unknown equipment')(
          framework.sharedReadModel.equipment.get(equipment.id)
        )
      );
      expect(result.trainers).toHaveLength(0);
    });
  });
});
