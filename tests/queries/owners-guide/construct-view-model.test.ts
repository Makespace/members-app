import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/owners-guide/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

// Under Purchase areas, the guide says who the Purchasers are for the
// reader's own areas.
describe("the owner's guide's purchasers", () => {
  let framework: TestFramework;
  const owner = arbitraryUser();
  const purchaser = arbitraryUser();
  const woodShop = faker.string.uuid() as UUID;
  const metalShop = faker.string.uuid() as UUID;
  const textiles = faker.string.uuid() as UUID;
  const kitchen = faker.string.uuid() as UUID;
  const workshops = faker.string.uuid() as UUID;
  const kitchenBudget = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [owner, purchaser]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    for (const [id, name] of [
      [woodShop, 'Wood Shop'],
      [metalShop, 'Metal Shop'],
      [textiles, 'Textiles'],
      [kitchen, 'Kitchen'],
    ] as const) {
      await framework.commands.area.create({id, name: name as NonEmptyString});
    }
    for (const areaId of [woodShop, metalShop, textiles]) {
      await framework.commands.area.addOwner({
        areaId,
        memberNumber: owner.memberNumber,
      });
    }
    await framework.commands.area.addOwner({
      areaId: woodShop,
      memberNumber: purchaser.memberNumber,
    });
    for (const [id, name, areaIds] of [
      [workshops, 'Workshops', [woodShop, metalShop]],
      [kitchenBudget, 'Kitchen', [kitchen]],
    ] as const) {
      await framework.commands.purchasingArea.create({
        id,
        name: name as NonEmptyString,
        yearlyBudget: 100_000,
      } as never);
      for (const areaId of areaIds) {
        await framework.commands.purchasingArea.assignArea({
          purchasingAreaId: id,
          areaId,
        } as never);
      }
    }
    await framework.commands.purchasingArea.addPurchaser({
      purchasingAreaId: workshops,
      memberNumber: purchaser.memberNumber,
    } as never);
  });

  afterEach(() => {
    framework.close();
  });

  const viewModelFor = (user = owner) =>
    pipe(
      constructViewModel(framework.sharedReadModel, user).reader,
      O.getOrElseW(() => {
        throw new Error('expected a logged-in reader');
      })
    );

  it('gives each purchasing area their areas are in once, with its Purchasers', () => {
    const {purchasingAreas} = viewModelFor();

    expect(purchasingAreas).toHaveLength(1);
    expect(purchasingAreas[0]).toMatchObject({
      id: workshops,
      name: 'Workshops',
      yourAreas: ['Metal Shop', 'Wood Shop'],
      active: false,
      yearlyBudgetPence: 100_000,
      remainingPence: 100_000,
    });
    expect(
      purchasingAreas[0].purchasers.map(p => p.memberNumber)
    ).toStrictEqual([purchaser.memberNumber]);
  });

  describe('this year', () => {
    const asMember = (user: typeof owner) => ({
      tag: 'user' as const,
      user: {memberNumber: user.memberNumber, emailAddress: user.emailAddress},
    });

    const submit = async (cost: string) => {
      const id = faker.string.uuid() as UUID;
      await framework.commands.purchaseRequest.submit({
        id,
        purchasingAreaId: workshops,
        purchaseType: 'improvements',
        affectsOtherAreas: false,
        affectedAreaIds: undefined,
        healthAndSafetyRisk: false,
        proposal: {need: '', options: [], preferred: '', risks: []},
        summary: 'Blades',
        purchases: [
          {shop: 'Axminster', items: [{notes: 'Blade', quantity: '1', cost}]},
        ],
        justification: 'Worn out',
        submittedByMemberNumber: undefined,
        buyingDirectly: undefined,
        amount: undefined,
        outsideBudget: undefined,
        actor: asMember(owner),
      } as never);
      return id;
    };

    beforeEach(async () => {
      await framework.commands.purchasingArea.activate({
        purchasingAreaId: workshops,
      } as never);
      const bought = await submit('50');
      await framework.commands.purchaseRequest.approve({
        id: bought,
        note: '',
        markBought: undefined,
        actualCost: undefined,
        actor: asMember(purchaser),
      } as never);
      await framework.commands.purchaseRequest.markBought({
        id: bought,
        actualCost: '',
        actor: asMember(purchaser),
      } as never);
      // Still waiting for approval: not a purchase, and not spent.
      await submit('20');
    });

    it('counts the purchases bought', () => {
      expect(viewModelFor().purchasingAreas[0].purchasesThisYear).toBe(1);
    });

    it("puts what was spent in this month's place", () => {
      const {monthNow, purchasingAreas} = viewModelFor();
      const months = purchasingAreas[0].spentByMonthPence;

      expect(months).toHaveLength(12);
      expect(months[monthNow - 1]).toBe(5000);
      expect(months.reduce((a, b) => a + b, 0)).toBe(5000);
    });
  });

  it('lists their areas that are in no purchasing area yet', () => {
    expect(viewModelFor().withoutPurchasingArea).toStrictEqual(['Textiles']);
  });

  it('is empty for somebody who owns no areas', () => {
    expect(viewModelFor(arbitraryUser())).toMatchObject({
      purchasingAreas: [],
      withoutPurchasingArea: [],
    });
  });
});
