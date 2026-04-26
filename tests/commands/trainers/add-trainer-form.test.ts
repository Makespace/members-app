import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {addTrainerForm} from '../../../src/commands/trainers/add-trainer-form';
import {EmailAddress} from '../../../src/types';
import {getRightOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('add trainer form', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('uses the canonical member number when filtering rejoined owners already marked as trainers', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const area = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const equipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: area.id,
    };

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create(area);
    await framework.commands.equipment.add(equipment);
    await framework.commands.area.addOwner({
      areaId: area.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId: equipment.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    const viewModel = getRightOrFail(
      await addTrainerForm.constructForm({equipment: equipment.id})({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })()
    );

    expect(viewModel.areaOwnersThatAreNotTrainers).toHaveLength(0);
  });

  it('offers a rejoined owner by their canonical member number when they are not already a trainer', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const area = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const equipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: area.id,
    };

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create(area);
    await framework.commands.equipment.add(equipment);
    await framework.commands.area.addOwner({
      areaId: area.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    const viewModel = getRightOrFail(
      await addTrainerForm.constructForm({equipment: equipment.id})({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })()
    );

    expect(
      viewModel.areaOwnersThatAreNotTrainers.map(owner => owner.memberNumber)
    ).toStrictEqual([newMemberNumber]);
  });
});
