import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {setSmallPurchaseAmount} from '../../../src/commands/purchasing-area/set-small-purchase-amount';
import {
  arbitraryActor,
  getLeftOrFail,
  getRightOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe("set a purchasing area's small purchase amount", () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const command = (smallPurchaseAmount: number) => ({
    purchasingAreaId,
    smallPurchaseAmount,
    actor: arbitraryActor(),
  });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('reads it in pounds', () => {
    expect(
      getRightOrFail(
        setSmallPurchaseAmount.decode({
          purchasingAreaId,
          smallPurchaseAmount: '750.00',
        })
      )
    ).toStrictEqual({purchasingAreaId, smallPurchaseAmount: 75_000});
  });

  it('refuses nothing at all', () => {
    expect(
      E.isLeft(
        setSmallPurchaseAmount.decode({
          purchasingAreaId,
          smallPurchaseAmount: '0',
        })
      )
    ).toBe(true);
  });

  it("can't be set for a purchasing area that doesn't exist", async () => {
    expect(
      getLeftOrFail(
        await setSmallPurchaseAmount.process({
          command: command(50_000),
          rm: framework.sharedReadModel,
        })()
      )
    ).toMatchObject({status: StatusCodes.NOT_FOUND});
  });

  describe('when the purchasing area exists', () => {
    beforeEach(() => {
      framework.insertIntoSharedReadModel(
        constructEvent('PurchasingAreaCreated')({
          actor: arbitraryActor(),
          id: purchasingAreaId,
          name: 'Wood Shop',
          yearlyBudgetPence: 100_000,
          active: true,
          smallPurchaseAmountPence: 100_000,
        })
      );
    });

    const amountNow = () =>
      O.map(
        (area: {smallPurchaseAmountPence: number}) =>
          area.smallPurchaseAmountPence
      )(framework.sharedReadModel.purchasing.get(purchasingAreaId, new Date()));

    it('sets it', async () => {
      await framework.commands.purchasingArea.setSmallPurchaseAmount(
        command(50_000) as never
      );
      expect(amountNow()).toStrictEqual(O.some(50_000));
    });

    it('does nothing when it is already that much', async () => {
      expect(
        await getTaskEitherRightOrFail(
          setSmallPurchaseAmount.process({
            command: command(100_000),
            rm: framework.sharedReadModel,
          })
        )
      ).toStrictEqual(O.none);
    });
  });
});
