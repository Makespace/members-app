import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent, EmailAddress} from '../../../src/types';
import {PurchaseRequestOutcome} from '../../../src/types/purchase-request-outcome';
import {getSomeOrFail, systemActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

describe('purchasing areas in the read model', () => {
  let framework: TestFramework;
  const now = new Date('2026-10-15T12:00:00Z');
  const purchasingAreaId = faker.string.uuid() as UUID;
  const craftRoomId = faker.string.uuid() as UUID;
  const artSpaceId = faker.string.uuid() as UUID;
  const memberNumber = faker.number.int({min: 1, max: 100_000});

  const insert = (...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]) =>
    events.forEach(event => framework.insertIntoSharedReadModel(event));

  const get = () =>
    getSomeOrFail(framework.sharedReadModel.purchasing.get(purchasingAreaId, now));

  const submitted = (
    outcome: PurchaseRequestOutcome,
    amountPence: number,
    budgetYear = 2026,
    id = faker.string.uuid() as UUID
  ) =>
    constructEvent('PurchaseRequestSubmitted')({
      actor: systemActor(),
      id,
      purchasingAreaId,
      submittedByMemberNumber: memberNumber,
      summary: faker.commerce.productName(),
      totalPence: amountPence,
      purchases: [
        {
          shop: 'Hobbycraft',
          items: [
            {
              url: null,
              sku: null,
              quantity: 1,
              costPence: amountPence,
              notes: 'Glue gun',
            },
          ],
          deliveryPence: 0,
        },
      ],
      justification: 'Needed',
      isMemberPaidConsumable: outcome === 'consumable',
      affectedAreaIds: [],
      healthAndSafetyRisk: false,
      proposal: null,
      outcome,
      approval: outcome === 'budget-proposal-needed' ? 'proposal' : 'none',
      outcomeReason: 'Because',
      budgetYear,
      yearlyBudgetPence: 150_000,
      spentThisYearPence: 0,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    insert(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: craftRoomId,
        name: 'Craft Room',
      }),
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: artSpaceId,
        name: 'Art Space',
      }),
      constructEvent('PurchasingAreaCreated')({
        actor: systemActor(),
        id: purchasingAreaId,
        name: 'Craft & Art',
        yearlyBudgetPence: 150_000,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe('a new purchasing area', () => {
    it('has its budget, nothing spent and nothing else yet', () => {
      expect(get()).toStrictEqual({
        id: purchasingAreaId,
        name: 'Craft & Art',
        yearlyBudgetPence: 150_000,
        usualBudgetPence: 150_000,
        areas: [],
        purchasers: [],
        budgetYear: 2026,
        spentThisYearPence: 0,
        recordedSpend: [],
        approvedSpendThisYearPence: 0,
        remainingPence: 150_000,
      });
    });

    it('is listed', () => {
      expect(
        framework.sharedReadModel.purchasing.getAll(now).map(pa => pa.id)
      ).toStrictEqual([purchasingAreaId]);
    });
  });

  describe('when renamed and given a new budget', () => {
    beforeEach(() => {
      insert(
        constructEvent('PurchasingAreaRenamed')({
          actor: systemActor(),
          purchasingAreaId,
          name: 'Crafts',
        }),
        constructEvent('PurchasingAreaBudgetSet')({
          actor: systemActor(),
          purchasingAreaId,
          yearlyBudgetPence: 200_000,
        })
      );
    });

    it('has the new name and budget', () => {
      expect(get()).toMatchObject({
        name: 'Crafts',
        yearlyBudgetPence: 200_000,
        remainingPence: 200_000,
      });
    });
  });

  describe('with areas assigned', () => {
    beforeEach(() => {
      insert(
        constructEvent('AreaAssignedToPurchasingArea')({
          actor: systemActor(),
          purchasingAreaId,
          areaId: craftRoomId,
        }),
        constructEvent('AreaAssignedToPurchasingArea')({
          actor: systemActor(),
          purchasingAreaId,
          areaId: artSpaceId,
        })
      );
    });

    it('lists them by name', () => {
      expect(get().areas).toStrictEqual([
        {id: artSpaceId, name: 'Art Space'},
        {id: craftRoomId, name: 'Craft Room'},
      ]);
    });

    it('knows which purchasing area each area belongs to', () => {
      expect(
        framework.sharedReadModel.purchasing.getForArea(craftRoomId)
      ).toStrictEqual(O.some({id: purchasingAreaId, name: 'Craft & Art'}));
      expect(
        framework.sharedReadModel.purchasing.getAllAreaAssignments()
      ).toHaveLength(2);
    });

    describe('and one is unassigned', () => {
      beforeEach(() => {
        insert(
          constructEvent('AreaUnassignedFromPurchasingArea')({
            actor: systemActor(),
            purchasingAreaId,
            areaId: craftRoomId,
          })
        );
      });

      it('no longer includes it', () => {
        expect(get().areas).toStrictEqual([{id: artSpaceId, name: 'Art Space'}]);
        expect(
          framework.sharedReadModel.purchasing.getForArea(craftRoomId)
        ).toStrictEqual(O.none);
      });
    });

    describe('and one of the areas is removed', () => {
      beforeEach(() => {
        insert(constructEvent('AreaRemoved')({actor: systemActor(), id: artSpaceId}));
      });

      it('no longer includes it', () => {
        expect(get().areas).toStrictEqual([
          {id: craftRoomId, name: 'Craft Room'},
        ]);
      });
    });
  });

  describe('with a purchaser who owns one of its areas', () => {
    beforeEach(() => {
      insert(
        constructEvent('MemberNumberLinkedToEmail')({
          actor: systemActor(),
          memberNumber,
          email: faker.internet.email() as EmailAddress,
          name: 'Pat Purchaser',
          formOfAddress: undefined,
        }),
        constructEvent('AreaAssignedToPurchasingArea')({
          actor: systemActor(),
          purchasingAreaId,
          areaId: craftRoomId,
        }),
        constructEvent('OwnerAdded')({
          actor: systemActor(),
          areaId: craftRoomId,
          memberNumber,
        }),
        constructEvent('PurchaserAdded')({
          actor: systemActor(),
          purchasingAreaId,
          memberNumber,
        })
      );
    });

    it('lists the purchaser as an owner', () => {
      expect(get().purchasers).toStrictEqual([
        expect.objectContaining({
          memberNumber,
          name: O.some('Pat Purchaser'),
          isOwnerOfAnArea: true,
        }),
      ]);
    });

    it('is among the purchasing areas they can purchase for', () => {
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );
      expect(
        framework.sharedReadModel.purchasing
          .getForPurchaser(member.userId, now)
          .map(pa => pa.id)
      ).toStrictEqual([purchasingAreaId]);
    });

    describe('who then stops being an owner', () => {
      beforeEach(() => {
        insert(
          constructEvent('OwnerRemoved')({
            actor: systemActor(),
            areaId: craftRoomId,
            memberNumber,
          })
        );
      });

      it('flags them', () => {
        expect(get().purchasers).toStrictEqual([
          expect.objectContaining({memberNumber, isOwnerOfAnArea: false}),
        ]);
      });
    });

    describe('who is then removed as a purchaser', () => {
      beforeEach(() => {
        insert(
          constructEvent('PurchaserRemoved')({
            actor: systemActor(),
            purchasingAreaId,
            memberNumber,
          })
        );
      });

      it('has no purchasers', () => {
        expect(get().purchasers).toStrictEqual([]);
      });
    });
  });

  describe('with purchase requests', () => {
    const latestId = faker.string.uuid() as UUID;

    beforeEach(() => {
      insert(
        submitted('budget', 40_000),
        submitted('budget-proposal-needed', 120_000),
        submitted('consumable', 9_000),
        submitted('budget', 63_000),
        submitted('consumable', 5_000),
        submitted('budget', 70_000, 2025),
        submitted('budget', 1_000, 2026, latestId)
      );
    });

    it("counts only this year's non-consumables as spent", () => {
      expect(get()).toMatchObject({
        spentThisYearPence: 224_000,
        remainingPence: -74_000,
      });
    });

    it("lists this year's requests, newest first", () => {
      const requests = framework.sharedReadModel.purchasing.getRequests(
        purchasingAreaId,
        2026
      );
      expect(requests).toHaveLength(6);
      expect(requests[0].id).toStrictEqual(latestId);
    });

    it('counts the shop total as spent', () => {
      const before = get().spentThisYearPence;
      insert(submitted('budget', 20_000));
      expect(get().spentThisYearPence).toBe(before + 20_000);
    });

    it('lists another year separately', () => {
      expect(
        framework.sharedReadModel.purchasing.getRequests(purchasingAreaId, 2025)
      ).toStrictEqual([expect.objectContaining({totalPence: 70_000})]);
    });

    it('finds a request by id', () => {
      expect(
        framework.sharedReadModel.purchasing.getRequest(latestId)
      ).toStrictEqual(
        O.some(
          expect.objectContaining({
            id: latestId,
            totalPence: 1_000,
            outcome: 'budget',
            purchases: [
              {
                shop: 'Hobbycraft',
                items: [
                  {
                    url: null,
                    sku: null,
                    quantity: 1,
                    costPence: 1_000,
                    notes: 'Glue gun',
                  },
                ],
                deliveryPence: 0,
              },
            ],
          })
        )
      );
    });

    it('uses the budget year asked about', () => {
      const lastYear = getSomeOrFail(
        framework.sharedReadModel.purchasing.get(
          purchasingAreaId,
          new Date('2025-06-01T12:00:00Z')
        )
      );
      expect(lastYear).toMatchObject({
        budgetYear: 2025,
        spentThisYearPence: 70_000,
      });
    });
  });
});
