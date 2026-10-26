import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {assignArea} from '../../../src/commands/purchasing-area/assign-area';
import {unassignArea} from '../../../src/commands/purchasing-area/unassign-area';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('assigning areas to purchasing areas', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const otherPurchasingAreaId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const command = {purchasingAreaId, areaId, actor: arbitraryActor()};

  const insert = (
    ...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]
  ) => events.forEach(event => framework.insertIntoSharedReadModel(event));

  const purchasingAreaCreated = (id: UUID, name: string) =>
    constructEvent('PurchasingAreaCreated')({
      actor: arbitraryActor(),
      id,
      name,
      yearlyBudgetPence: 0,
      active: true,
    });
  const areaCreated = constructEvent('AreaCreated')({
    actor: arbitraryActor(),
    id: areaId,
    name: 'Craft Room',
  });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('assign', () => {
    it('fails when the purchasing area does not exist', async () => {
      insert(areaCreated);
      const result = getLeftOrFail(
        await assignArea.process({command, rm: framework.sharedReadModel})()
      );
      expect(result).toMatchObject({
        message: 'The requested purchasing area does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });

    it('fails when the area does not exist', async () => {
      insert(purchasingAreaCreated(purchasingAreaId, 'Craft & Art'));
      const result = getLeftOrFail(
        await assignArea.process({command, rm: framework.sharedReadModel})()
      );
      expect(result).toMatchObject({
        message: 'The requested area does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });

    describe('when both exist', () => {
      beforeEach(() => {
        insert(
          purchasingAreaCreated(purchasingAreaId, 'Craft & Art'),
          purchasingAreaCreated(otherPurchasingAreaId, 'Textiles'),
          areaCreated
        );
      });

      it('assigns an area that is in no purchasing area', async () => {
        const result = await getTaskEitherRightOrFail(
          assignArea.process({command, rm: framework.sharedReadModel})
        );
        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'AreaAssignedToPurchasingArea',
              purchasingAreaId,
              areaId,
            })
          )
        );
      });

      it('does nothing when the area is already in it', async () => {
        insert(
          constructEvent('AreaAssignedToPurchasingArea')({
            actor: arbitraryActor(),
            purchasingAreaId,
            areaId,
          })
        );
        const result = await getTaskEitherRightOrFail(
          assignArea.process({command, rm: framework.sharedReadModel})
        );
        expect(result).toStrictEqual(O.none);
      });

      it('refuses an area that belongs to another purchasing area', async () => {
        insert(
          constructEvent('AreaAssignedToPurchasingArea')({
            actor: arbitraryActor(),
            purchasingAreaId: otherPurchasingAreaId,
            areaId,
          })
        );
        const result = getLeftOrFail(
          await assignArea.process({command, rm: framework.sharedReadModel})()
        );
        expect(result).toMatchObject({
          message:
            "That area already belongs to the purchasing area 'Textiles'. Remove it from there first.",
          status: StatusCodes.BAD_REQUEST,
        });
      });
    });
  });

  describe('unassign', () => {
    beforeEach(() => {
      insert(purchasingAreaCreated(purchasingAreaId, 'Craft & Art'), areaCreated);
    });

    it('fails when the area is not in the purchasing area', async () => {
      const result = getLeftOrFail(
        await unassignArea.process({command, rm: framework.sharedReadModel})()
      );
      expect(result).toMatchObject({
        message: 'The requested area is not part of the requested purchasing area',
        status: StatusCodes.BAD_REQUEST,
      });
    });

    it('takes an area out of the purchasing area', async () => {
      insert(
        constructEvent('AreaAssignedToPurchasingArea')({
          actor: arbitraryActor(),
          purchasingAreaId,
          areaId,
        })
      );
      const result = await getTaskEitherRightOrFail(
        unassignArea.process({command, rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaUnassignedFromPurchasingArea',
            purchasingAreaId,
            areaId,
          })
        )
      );
    });
  });
});
