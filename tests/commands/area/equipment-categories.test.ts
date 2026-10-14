import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {UserActor} from '../../../src/types/actor';
import {
  getLeftOrFail,
  getTaskEitherRightOrFail,
  systemActor,
} from '../../helpers';
import {addEquipmentCategory} from '../../../src/commands/area/add-equipment-category';
import {removeEquipmentCategory} from '../../../src/commands/area/remove-equipment-category';
import {setEquipmentCategories} from '../../../src/commands/area/set-equipment-categories';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const AREA_OWNER = 31;
const SUPER_USER = 32;
const OUTSIDER = 33;
const OTHER_AREA_OWNER = 34;

const userActorWithMember = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@test.com` as EmailAddress,
    memberNumber,
  },
});

describe('area equipment categories', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const otherAreaId = faker.string.uuid() as UUID;
  const wheelsId = faker.string.uuid() as UUID;
  const otherAreaCategoryId = faker.string.uuid() as UUID;
  const standId = faker.string.uuid() as UUID;
  const pumpId = faker.string.uuid() as UUID;
  const otherAreaEquipmentId = faker.string.uuid() as UUID;

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
    insert(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: otherAreaId,
        name: 'Wood Shop',
      })
    );
    for (const memberNumber of [
      AREA_OWNER,
      SUPER_USER,
      OUTSIDER,
      OTHER_AREA_OWNER,
    ]) {
      insert(
        constructEvent('MemberNumberLinkedToEmail')({
          actor: systemActor(),
          memberNumber,
          email: `member${memberNumber}@test.com` as EmailAddress,
          name: undefined,
          formOfAddress: undefined,
        })
      );
    }
    insert(
      constructEvent('OwnerAdded')({
        actor: systemActor(),
        areaId,
        memberNumber: AREA_OWNER,
      })
    );
    insert(
      constructEvent('OwnerAdded')({
        actor: systemActor(),
        areaId: otherAreaId,
        memberNumber: OTHER_AREA_OWNER,
      })
    );
    insert(
      constructEvent('SuperUserDeclared')({
        actor: systemActor(),
        memberNumber: SUPER_USER,
      })
    );
    for (const [id, name, inArea] of [
      [standId, 'Truing Stand', areaId],
      [pumpId, 'Floor Pump', areaId],
      [otherAreaEquipmentId, 'Bandsaw', otherAreaId],
    ] as const) {
      insert(
        constructEvent('EquipmentAdded')({
          actor: systemActor(),
          category: 'orange',
          id,
          name,
          areaId: inArea,
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
        areaId: otherAreaId,
        categoryId: otherAreaCategoryId,
        name: 'Saws',
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe('who may change them', () => {
    const allowed = (memberNumber: number) =>
      addEquipmentCategory.isAuthorized({
        actor: userActorWithMember(memberNumber),
        rm: framework.sharedReadModel,
        input: {
          areaId,
          categoryId: faker.string.uuid() as UUID,
          name: 'Chains' as NonEmptyString,
        },
      });

    it('lets an owner of the area', () => {
      expect(allowed(AREA_OWNER)).toBe(true);
    });

    it('lets a super user', () => {
      expect(allowed(SUPER_USER)).toBe(true);
    });

    it('does not let an owner of a different area', () => {
      expect(allowed(OTHER_AREA_OWNER)).toBe(false);
    });

    it('does not let a member who owns no area', () => {
      expect(allowed(OUTSIDER)).toBe(false);
    });

    it('holds the saving of assignments to the same bar', () => {
      expect(
        setEquipmentCategories.isAuthorized({
          actor: userActorWithMember(OTHER_AREA_OWNER),
          rm: framework.sharedReadModel,
          input: {areaId, assignments: {}},
        })
      ).toBe(false);
    });
  });

  describe('adding a category', () => {
    const add = (name: string, categoryId = faker.string.uuid() as UUID) =>
      addEquipmentCategory.process({
        command: {
          areaId,
          categoryId,
          name: name as NonEmptyString,
          actor: userActorWithMember(AREA_OWNER),
        },
        rm: framework.sharedReadModel,
      });

    it('records it with its name trimmed', async () => {
      const result = await getTaskEitherRightOrFail(add('  Chains  '));
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaEquipmentCategoryAdded',
            areaId,
            name: 'Chains',
          })
        )
      );
    });

    it('does nothing when the same form is submitted twice', async () => {
      const result = await getTaskEitherRightOrFail(add('Rims', wheelsId));
      expect(result).toStrictEqual(O.none);
    });

    it('refuses a name the area already uses, whatever its case', async () => {
      const failure = getLeftOrFail(await add('wheels')());
      expect(failure.status).toBe(400);
    });

    it('allows a name another area already uses', async () => {
      const result = await getTaskEitherRightOrFail(add('Saws'));
      expect(O.isSome(result)).toBe(true);
    });
  });

  describe('removing a category', () => {
    const remove = (categoryId: UUID) =>
      getTaskEitherRightOrFail(
        removeEquipmentCategory.process({
          command: {
            areaId,
            categoryId,
            actor: userActorWithMember(AREA_OWNER),
          },
          rm: framework.sharedReadModel,
        })
      );

    it('records the removal', async () => {
      expect(await remove(wheelsId)).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaEquipmentCategoryRemoved',
            categoryId: wheelsId,
          })
        )
      );
    });

    it("does nothing for another area's category", async () => {
      expect(await remove(otherAreaCategoryId)).toStrictEqual(O.none);
    });
  });

  describe('saving the table', () => {
    const save = (assignments: Record<string, string>) =>
      setEquipmentCategories.process({
        command: {
          areaId,
          assignments,
          actor: userActorWithMember(AREA_OWNER),
        },
        rm: framework.sharedReadModel,
      });

    it('records only the equipment whose category changed', async () => {
      const result = await getTaskEitherRightOrFail(
        save({[standId]: wheelsId, [pumpId]: ''})
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaEquipmentCategoriesAssigned',
            areaId,
            assignments: [{equipmentId: standId, categoryId: wheelsId}],
          })
        )
      );
    });

    it('records nothing when nothing changed', async () => {
      const result = await getTaskEitherRightOrFail(
        save({[standId]: '', [pumpId]: ''})
      );
      expect(result).toStrictEqual(O.none);
    });

    it('refuses equipment from another area', async () => {
      const failure = getLeftOrFail(
        await save({[otherAreaEquipmentId]: wheelsId})()
      );
      expect(failure.status).toBe(400);
    });

    it("refuses another area's category", async () => {
      const failure = getLeftOrFail(
        await save({[standId]: otherAreaCategoryId})()
      );
      expect(failure.status).toBe(400);
    });

    it('decodes a submission with no equipment in it', () => {
      expect(setEquipmentCategories.decode({areaId})._tag).toBe('Right');
    });
  });
});
