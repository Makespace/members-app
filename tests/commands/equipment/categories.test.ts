import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {UserActor} from '../../../src/types/actor';
import {getTaskEitherRightOrFail, systemActor} from '../../helpers';
import {add} from '../../../src/commands/equipment/add';
import {setCategory} from '../../../src/commands/equipment/set-category';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const AREA_OWNER = 21;
const SUPER_USER = 22;
const OUTSIDER = 23;

const userActorWithMember = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@test.com` as EmailAddress,
    memberNumber,
  },
});

describe('equipment categories', () => {
  let framework: TestFramework;
  let areaId: UUID;
  let equipmentId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    const insert = framework.insertIntoSharedReadModel;

    insert(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: areaId,
        name: 'Wood Shop',
      })
    );
    for (const memberNumber of [AREA_OWNER, SUPER_USER, OUTSIDER]) {
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
      constructEvent('SuperUserDeclared')({
        actor: systemActor(),
        memberNumber: SUPER_USER,
      })
    );
    insert(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        category: 'red',
        id: equipmentId,
        name: 'Bandsaw',
        areaId,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  const addInput = (category?: 'red' | 'orange' | 'green') => ({
    id: faker.string.uuid() as UUID,
    name: 'Bench Vice' as NonEmptyString,
    areaId,
    ...(category === undefined ? {} : {category}),
  });

  describe('who may add equipment', () => {
    it('lets an area owner add orange and green equipment to their area', () => {
      for (const category of ['orange', 'green'] as const) {
        expect(
          add.isAuthorized({
            actor: userActorWithMember(AREA_OWNER),
            rm: framework.sharedReadModel,
            input: addInput(category),
          })
        ).toBe(true);
      }
    });

    it('does not let an area owner add red equipment (training setup is admin work)', () => {
      expect(
        add.isAuthorized({
          actor: userActorWithMember(AREA_OWNER),
          rm: framework.sharedReadModel,
          input: addInput('red'),
        })
      ).toBe(false);
    });

    it('treats an absent category as red, so owners cannot add it', () => {
      expect(
        add.isAuthorized({
          actor: userActorWithMember(AREA_OWNER),
          rm: framework.sharedReadModel,
          input: addInput(),
        })
      ).toBe(false);
    });

    it('lets a super user add any category', () => {
      for (const category of ['red', 'orange', 'green'] as const) {
        expect(
          add.isAuthorized({
            actor: userActorWithMember(SUPER_USER),
            rm: framework.sharedReadModel,
            input: addInput(category),
          })
        ).toBe(true);
      }
    });

    it('does not let a member who owns no area add anything', () => {
      expect(
        add.isAuthorized({
          actor: userActorWithMember(OUTSIDER),
          rm: framework.sharedReadModel,
          input: addInput('green'),
        })
      ).toBe(false);
    });
  });

  describe('adding', () => {
    it('records the chosen category', async () => {
      const input = addInput('orange');
      const result = await getTaskEitherRightOrFail(
        add.process({
          command: {...input, actor: userActorWithMember(AREA_OWNER)},
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'EquipmentAdded', category: 'orange'})
        )
      );
    });

    it('defaults to red when no category is given', async () => {
      const input = addInput();
      const result = await getTaskEitherRightOrFail(
        add.process({
          command: {...input, actor: userActorWithMember(SUPER_USER)},
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'EquipmentAdded', category: 'red'})
        )
      );
    });

    it('decodes an absent category rather than rejecting the form', () => {
      const decoded = add.decode({
        id: faker.string.uuid(),
        name: 'Pillar Drill',
        areaId,
      });
      expect(E.isRight(decoded)).toBe(true);
    });
  });

  describe('recategorising', () => {
    it('emits EquipmentCategoryChanged for a real change', async () => {
      const result = await getTaskEitherRightOrFail(
        setCategory.process({
          command: {
            equipmentId,
            category: 'orange',
            actor: userActorWithMember(SUPER_USER),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'EquipmentCategoryChanged',
            equipmentId,
            category: 'orange',
          })
        )
      );
    });

    it('does nothing when the category already matches', async () => {
      const result = await getTaskEitherRightOrFail(
        setCategory.process({
          command: {
            equipmentId,
            category: 'red',
            actor: userActorWithMember(SUPER_USER),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(O.none);
    });
  });
});
