import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent, EmailAddress} from '../../../src/types';
import {addPurchaser} from '../../../src/commands/purchasing-area/add-purchaser';
import {removePurchaser} from '../../../src/commands/purchasing-area/remove-purchaser';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('purchasers', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const craftRoomId = faker.string.uuid() as UUID;
  const woodShopId = faker.string.uuid() as UUID;
  const memberNumber = faker.number.int({min: 1, max: 100_000});
  const command = {purchasingAreaId, memberNumber, actor: arbitraryActor()};

  const insert = (
    ...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]
  ) => events.forEach(event => framework.insertIntoSharedReadModel(event));

  const memberLinked = constructEvent('MemberNumberLinkedToEmail')({
    actor: arbitraryActor(),
    memberNumber,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('add', () => {
    it('fails when the purchasing area does not exist', async () => {
      insert(memberLinked);
      const result = getLeftOrFail(
        await addPurchaser.process({command, rm: framework.sharedReadModel})()
      );
      expect(result).toMatchObject({status: StatusCodes.NOT_FOUND});
    });

    describe('when the purchasing area has areas', () => {
      beforeEach(() => {
        insert(
          constructEvent('AreaCreated')({
            actor: arbitraryActor(),
            id: craftRoomId,
            name: 'Craft Room',
          }),
          constructEvent('AreaCreated')({
            actor: arbitraryActor(),
            id: woodShopId,
            name: 'Wood Shop',
          }),
          constructEvent('PurchasingAreaCreated')({
            actor: arbitraryActor(),
            id: purchasingAreaId,
            name: 'Craft & Art',
            yearlyBudgetPence: 0,
            active: true,
          }),
          constructEvent('AreaAssignedToPurchasingArea')({
            actor: arbitraryActor(),
            purchasingAreaId,
            areaId: craftRoomId,
          })
        );
      });

      it('fails when the member does not exist', async () => {
        const result = getLeftOrFail(
          await addPurchaser.process({command, rm: framework.sharedReadModel})()
        );
        expect(result).toMatchObject({
          message: 'The requested member does not exist',
          status: StatusCodes.NOT_FOUND,
        });
      });

      describe('and the member owns none of its areas', () => {
        beforeEach(() => {
          insert(
            memberLinked,
            // An owner, but of an area outside this purchasing area.
            constructEvent('OwnerAdded')({
              actor: arbitraryActor(),
              areaId: woodShopId,
              memberNumber,
            })
          );
        });

        it('refuses to make them a purchaser', async () => {
          const result = getLeftOrFail(
            await addPurchaser.process({
              command,
              rm: framework.sharedReadModel,
            })()
          );
          expect(result).toMatchObject({
            message:
              "A purchaser must be an owner of at least one area in 'Craft & Art'. Make them an owner first.",
            status: StatusCodes.BAD_REQUEST,
          });
        });
      });

      describe('and the member owns one of its areas', () => {
        beforeEach(() => {
          insert(
            memberLinked,
            constructEvent('OwnerAdded')({
              actor: arbitraryActor(),
              areaId: craftRoomId,
              memberNumber,
            })
          );
        });

        it('makes them a purchaser', async () => {
          const result = await getTaskEitherRightOrFail(
            addPurchaser.process({command, rm: framework.sharedReadModel})
          );
          expect(result).toStrictEqual(
            O.some(
              expect.objectContaining({
                type: 'PurchaserAdded',
                purchasingAreaId,
                memberNumber,
              })
            )
          );
        });

        it('does nothing when they already are one', async () => {
          insert(
            constructEvent('PurchaserAdded')({
              actor: arbitraryActor(),
              purchasingAreaId,
              memberNumber,
            })
          );
          const result = await getTaskEitherRightOrFail(
            addPurchaser.process({command, rm: framework.sharedReadModel})
          );
          expect(result).toStrictEqual(O.none);
        });
      });
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      insert(
        memberLinked,
        constructEvent('AreaCreated')({
          actor: arbitraryActor(),
          id: craftRoomId,
          name: 'Craft Room',
        }),
        constructEvent('PurchasingAreaCreated')({
          actor: arbitraryActor(),
          id: purchasingAreaId,
          name: 'Craft & Art',
          yearlyBudgetPence: 0,
          active: true,
        })
      );
    });

    it('fails when the member is not a purchaser', async () => {
      const result = getLeftOrFail(
        await removePurchaser.process({command, rm: framework.sharedReadModel})()
      );
      expect(result).toMatchObject({
        message:
          'The requested member is not a purchaser for the requested purchasing area',
        status: StatusCodes.BAD_REQUEST,
      });
    });

    it('removes a purchaser', async () => {
      insert(
        constructEvent('PurchaserAdded')({
          actor: arbitraryActor(),
          purchasingAreaId,
          memberNumber,
        })
      );
      const result = await getTaskEitherRightOrFail(
        removePurchaser.process({command, rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'PurchaserRemoved',
            purchasingAreaId,
            memberNumber,
          })
        )
      );
    });
  });
});
