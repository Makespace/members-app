import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {setSmallRepairsAmount} from '../../../src/commands/purchasing-area/set-small-repairs-amount';
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

describe("set a purchasing area's small repairs amount", () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const command = (smallRepairsAmount: number) => ({
    purchasingAreaId,
    smallRepairsAmount,
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
        setSmallRepairsAmount.decode({
          purchasingAreaId,
          smallRepairsAmount: '750.00',
        })
      )
    ).toStrictEqual({purchasingAreaId, smallRepairsAmount: 75_000});
  });

  it('refuses nothing at all', () => {
    expect(
      E.isLeft(
        setSmallRepairsAmount.decode({
          purchasingAreaId,
          smallRepairsAmount: '0',
        })
      )
    ).toBe(true);
  });

  it("can't be set for a purchasing area that doesn't exist", async () => {
    expect(
      getLeftOrFail(
        await setSmallRepairsAmount.process({
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
        (area: {smallRepairsAmountPence: number}) =>
          area.smallRepairsAmountPence
      )(framework.sharedReadModel.purchasing.get(purchasingAreaId, new Date()));

    it('sets it', async () => {
      await framework.commands.purchasingArea.setSmallRepairsAmount(
        command(50_000) as never
      );
      expect(amountNow()).toStrictEqual(O.some(50_000));
    });

    it('does nothing when it is already that much', async () => {
      expect(
        await getTaskEitherRightOrFail(
          setSmallRepairsAmount.process({
            command: command(15_000),
            rm: framework.sharedReadModel,
          })
        )
      ).toStrictEqual(O.none);
    });
  });
});
