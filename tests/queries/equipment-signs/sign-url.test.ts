import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/equipment-signs/construct-view-model';
import {equipment} from '../../../src/queries/equipment';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('the code on a sign', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const superUser = arbitraryUser();

  const signFor = async (name: string) => {
    const viewModel = getRightOrFail(
      await constructViewModel(framework.depsForCommands, {areaId})(superUser)()
    );
    return viewModel.signs.find(sign => sign.name === name);
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Hand Drill' as NonEmptyString,
      areaId,
      category: 'green',
    });
  });

  afterEach(() => {
    framework.close();
  });

  // The address is printed and then typed or scanned months later, so the
  // thing that matters is that the app still answers it, with this
  // machine's page.
  it('prints an address the app resolves back to the same machine', async () => {
    const sign = await signFor('Band Saw');
    const reference = sign!.url.split('/equipment/')[1];

    const page = getRightOrFail(
      await equipment(framework.depsForCommands)(
        superUser,
        {equipment: reference},
        {}
      )()
    );

    expect(reference).toBe('wood-shop-band-saw');
    expect(JSON.stringify(page)).toContain('Band Saw');
  });

  // Green equipment has no training, but still has a guide and tickets, so
  // its sign leads to the same kind of page.
  it('gives every colour of equipment one', async () => {
    const sign = await signFor('Hand Drill');

    expect(sign?.url).toMatch(/\/equipment\/wood-shop-hand-drill$/);
  });
});
