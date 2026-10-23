import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {Actor, constructEvent, EmailAddress} from '../../../src/types';
import {approve} from '../../../src/commands/purchase-request/approve';
import {decline} from '../../../src/commands/purchase-request/decline';
import {arbitraryActor} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// Who can approve or decline a purchase request: a purchaser of its area
// when it needs no proposal, a super user (a director) always.
describe('approving or declining a purchase request', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const purchaserNumber = 1001;
  const ownerNumber = 1002;
  const superUserNumber = 1003;
  const userActor = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {memberNumber, emailAddress: faker.internet.email() as EmailAddress},
  });

  const insert = (
    ...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]
  ) => events.forEach(event => framework.insertIntoSharedReadModel(event));

  // A request from the owner costing this much, in pounds.
  const requested = async (cost: string) => {
    const id = faker.string.uuid() as UUID;
    await framework.commands.purchaseRequest.submit({
      id,
      purchasingAreaId,
      isMemberPaidConsumable: false,
      affectsOtherAreas: false,
      affectedAreaIds: undefined,
      healthAndSafetyRisk: false,
      proposal: {
        need: 'Needed',
        options: [],
        preferred: 'Buy it',
        risks: [],
      },
      summary: 'Thing' as never,
      purchases: [
        {shop: 'Shop', items: [{notes: 'Thing', quantity: '1', cost}]},
      ],
      justification: 'Needed' as never,
      submittedByMemberNumber: undefined,
      buyingDirectly: undefined,
      amount: undefined,
      outsideBudget: undefined,
      actor: userActor(ownerNumber),
    });
    return id;
  };

  const canApprove = (actor: Actor, id: UUID) =>
    approve.isAuthorized({
      actor,
      rm: framework.sharedReadModel,
      input: {id, note: undefined},
    }) &&
    decline.isAuthorized({
      actor,
      rm: framework.sharedReadModel,
      input: {id, reason: 'No' as never},
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const memberNumber of [purchaserNumber, ownerNumber, superUserNumber]) {
      insert(
        constructEvent('MemberNumberLinkedToEmail')({
          actor: arbitraryActor(),
          memberNumber,
          email: faker.internet.email() as EmailAddress,
          name: undefined,
          formOfAddress: undefined,
        })
      );
    }
    insert(
      constructEvent('SuperUserDeclared')({
        actor: arbitraryActor(),
        memberNumber: superUserNumber,
      }),
      constructEvent('AreaCreated')({actor: arbitraryActor(), id: areaId, name: 'Wood Shop'}),
      constructEvent('PurchasingAreaCreated')({
        actor: arbitraryActor(),
        id: purchasingAreaId,
        name: 'Wood Shop',
        yearlyBudgetPence: 500_000,
      }),
      constructEvent('AreaAssignedToPurchasingArea')({
        actor: arbitraryActor(),
        purchasingAreaId,
        areaId,
      }),
      constructEvent('OwnerAdded')({actor: arbitraryActor(), areaId, memberNumber: purchaserNumber}),
      constructEvent('OwnerAdded')({actor: arbitraryActor(), areaId, memberNumber: ownerNumber}),
      constructEvent('PurchaserAdded')({
        actor: arbitraryActor(),
        purchasingAreaId,
        memberNumber: purchaserNumber,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe('one needing no proposal (purchaser approval)', () => {
    it('can be decided by a purchaser of its area, or a super user', async () => {
      const id = await requested('50');
      expect(canApprove(userActor(purchaserNumber), id)).toBe(true);
      expect(canApprove(userActor(superUserNumber), id)).toBe(true);
    });

    it("can't be decided by an owner who isn't a purchaser", async () => {
      const id = await requested('50');
      expect(canApprove(userActor(ownerNumber), id)).toBe(false);
    });

    it("can't be decided by a purchaser who no longer owns any of its areas", async () => {
      const id = await requested('50');
      insert(
        constructEvent('OwnerRemoved')({
          actor: arbitraryActor(),
          areaId,
          memberNumber: purchaserNumber,
        })
      );
      expect(canApprove(userActor(purchaserNumber), id)).toBe(false);
    });
  });

  describe('one needing a proposal (director approval)', () => {
    it('can be decided only by a super user', async () => {
      const id = await requested('1200');
      expect(canApprove(userActor(purchaserNumber), id)).toBe(false);
      expect(canApprove(userActor(superUserNumber), id)).toBe(true);
    });
  });
});
