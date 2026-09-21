import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {addNameAlias} from '../../../src/commands/equipment/add-name-alias';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

describe('add-equipment-name-alias', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: faker.commerce.productName() as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: faker.commerce.productName() as NonEmptyString,
      areaId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('emits an EquipmentNameAliasAdded event for known equipment', async () => {
    const result = await getTaskEitherRightOrFail(
      addNameAlias.process({
        command: {
          equipmentId,
          alias: 'Laser cutter (Jaws)' as NonEmptyString,
          actor: arbitraryActor(),
        },
        rm: framework.sharedReadModel,
      })
    );

    expect(getSomeOrFail(result)).toMatchObject({
      type: 'EquipmentNameAliasAdded',
      equipmentId,
      alias: 'Laser cutter (Jaws)',
    });
  });

  it('fails for unknown equipment', async () => {
    const result = await addNameAlias.process({
      command: {
        equipmentId: faker.string.uuid() as UUID,
        alias: 'Anything' as NonEmptyString,
        actor: arbitraryActor(),
      },
      rm: framework.sharedReadModel,
    })();

    expect(result).toMatchObject({
      _tag: 'Left',
      left: {status: StatusCodes.NOT_FOUND},
    });
  });

  it('rejects an empty alias at decode time', () => {
    expect(
      addNameAlias.decode({equipmentId, alias: ''})
    ).toMatchObject({_tag: 'Left'});
  });
});
