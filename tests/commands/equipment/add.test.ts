import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';
import {add} from '../../../src/commands/equipment/add';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('add-equipment', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const id = v4() as UUID;
  const name = faker.commerce.productName() as NonEmptyString;
  const command = {
    id,
    name,
    areaId,
    actor: arbitraryActor(),
  };

  it('adds equipment when it does not already exist', async () => {
    const result = await getTaskEitherRightOrFail(
      add.process({
        command,
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(
      O.some(
        expect.objectContaining({
          type: 'EquipmentAdded',
          id,
          name,
          areaId,
        })
      )
    );
  });

  it('does nothing when the equipment already exists', async () => {
    framework.insertIntoSharedReadModel(
      constructEvent('AreaCreated')({
        id: areaId,
        name: areaName,
        actor: arbitraryActor(),
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('EquipmentAdded')({
        id,
        name,
        areaId,
        actor: arbitraryActor(),
      })
    );

    const result = await getTaskEitherRightOrFail(
      add.process({
        command,
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(O.none);
  });
});
