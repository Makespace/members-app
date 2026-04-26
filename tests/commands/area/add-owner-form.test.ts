import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {addOwnerForm} from '../../../src/commands/area/add-owner-form';
import {EmailAddress} from '../../../src/types';
import {getRightOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('add owner form', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('shows a rejoined owner once and excludes them from potential owners', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const area = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
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
    await framework.commands.area.addOwner({
      areaId: area.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    const viewModel = getRightOrFail(
      await addOwnerForm.constructForm({area: area.id})({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })()
    );

    expect(viewModel.areaOwners.existing.map(owner => owner.memberNumber)).toStrictEqual([
      newMemberNumber,
    ]);
    expect(
      viewModel.areaOwners.potential.map(owner => owner.memberNumber)
    ).not.toContain(newMemberNumber);
    expect(viewModel.areaOwners.potential).toHaveLength(0);
  });
});
