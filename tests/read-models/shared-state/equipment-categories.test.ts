import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {systemActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

describe('equipment categories in the read model', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const redId = faker.string.uuid() as UUID;
  const orangeId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const insert = framework.insertIntoSharedReadModel;
    insert(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: areaId,
        name: 'Wood Shop',
      })
    );
    insert(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        category: 'red',
        id: redId,
        name: 'Bandsaw',
        areaId,
      })
    );
    insert(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        category: 'orange',
        id: orangeId,
        name: 'Bench Vice',
        areaId,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  const categoryOf = (id: UUID) =>
    pipe(
      framework.sharedReadModel.equipment.get(id),
      O.match(
        () => 'missing',
        equipment => equipment.category as string
      )
    );

  it('records the category each piece of equipment was added with', () => {
    expect(categoryOf(redId)).toBe('red');
    expect(categoryOf(orangeId)).toBe('orange');
  });

  it('applies EquipmentCategoryChanged', () => {
    framework.insertIntoSharedReadModel(
      constructEvent('EquipmentCategoryChanged')({
        actor: systemActor(),
        equipmentId: redId,
        category: 'green',
      })
    );
    expect(categoryOf(redId)).toBe('green');
    expect(categoryOf(orangeId)).toBe('orange');
  });

  it('exposes the category on the minimal listing used by pages', () => {
    const listed = framework.sharedReadModel.equipment
      .getAllMinimal()
      .map(equipment => [equipment.name, equipment.category]);
    expect(listed).toEqual(
      expect.arrayContaining([
        ['Bandsaw', 'red'],
        ['Bench Vice', 'orange'],
      ])
    );
  });
});
