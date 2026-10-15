import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {systemActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

describe('area equipment categories in the read model', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const wheelsId = faker.string.uuid() as UUID;
  const chainsId = faker.string.uuid() as UUID;
  const standId = faker.string.uuid() as UUID;
  const whipId = faker.string.uuid() as UUID;

  const categoryOf = (equipmentId: UUID) =>
    framework.sharedReadModel.equipment
      .getForAreaMinimal(areaId)
      .find(item => item.id === equipmentId)?.areaCategoryId;

  beforeEach(async () => {
    framework = await initTestFramework();
    const insert = framework.insertIntoSharedReadModel;
    insert(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: areaId,
        name: 'Bike Space',
      })
    );
    for (const [id, name] of [
      [standId, 'Truing Stand'],
      [whipId, 'Chain Whip'],
    ] as const) {
      insert(
        constructEvent('EquipmentAdded')({
          actor: systemActor(),
          category: 'orange',
          id,
          name,
          areaId,
        })
      );
    }
    insert(
      constructEvent('AreaEquipmentCategoryAdded')({
        actor: systemActor(),
        areaId,
        categoryId: wheelsId,
        name: 'Wheels',
      })
    );
    insert(
      constructEvent('AreaEquipmentCategoryAdded')({
        actor: systemActor(),
        areaId,
        categoryId: chainsId,
        name: 'Chains',
      })
    );
    insert(
      constructEvent('AreaEquipmentCategoriesAssigned')({
        actor: systemActor(),
        areaId,
        assignments: [
          {equipmentId: standId, categoryId: wheelsId},
          {equipmentId: whipId, categoryId: chainsId},
        ],
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  it('lists an area’s categories in the order they were added', () => {
    expect(
      framework.sharedReadModel.area
        .getEquipmentCategories(areaId)
        .map(category => category.name)
    ).toStrictEqual(['Wheels', 'Chains']);
  });

  it('records the category each piece of equipment is assigned', () => {
    expect(categoryOf(standId)).toStrictEqual(O.some(wheelsId));
    expect(categoryOf(whipId)).toStrictEqual(O.some(chainsId));
  });

  it('takes equipment out of a category when assigned none', () => {
    framework.insertIntoSharedReadModel(
      constructEvent('AreaEquipmentCategoriesAssigned')({
        actor: systemActor(),
        areaId,
        assignments: [{equipmentId: standId, categoryId: null}],
      })
    );
    expect(categoryOf(standId)).toStrictEqual(O.none);
  });

  it('leaves equipment uncategorised when its category is removed', () => {
    framework.insertIntoSharedReadModel(
      constructEvent('AreaEquipmentCategoryRemoved')({
        actor: systemActor(),
        areaId,
        categoryId: wheelsId,
      })
    );
    expect(categoryOf(standId)).toStrictEqual(O.none);
    expect(categoryOf(whipId)).toStrictEqual(O.some(chainsId));
    expect(
      framework.sharedReadModel.area
        .getAllEquipmentCategories()
        .map(category => category.name)
    ).toStrictEqual(['Chains']);
  });

  it('drops an area’s categories with the area', () => {
    framework.insertIntoSharedReadModel(
      constructEvent('AreaRemoved')({actor: systemActor(), id: areaId})
    );
    expect(
      framework.sharedReadModel.area.getAllEquipmentCategories()
    ).toStrictEqual([]);
  });
});
