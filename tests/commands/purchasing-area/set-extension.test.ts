import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {setExtension} from '../../../src/commands/purchasing-area/set-extension';
import {budgetYearOf} from '../../../src/purchasing/budget-year';
import {
  arbitraryActor,
  getLeftOrFail,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe("set an extension to a purchasing area's yearly allowance", () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const thisYear = budgetYearOf(new Date());
  const command = (budgetYear: number, extension: number) =>
    ({
      purchasingAreaId,
      budgetYear,
      extension,
      actor: arbitraryActor(),
    }) as never;
  const process = (budgetYear: number, extension: number) =>
    setExtension.process({
      command: command(budgetYear, extension),
      rm: framework.sharedReadModel,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
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

  afterEach(() => {
    framework.close();
  });

  it('reads the year and an amount in pounds', () => {
    expect(
      getRightOrFail(
        setExtension.decode({
          purchasingAreaId,
          budgetYear: '2027',
          extension: '500.00',
        })
      )
    ).toStrictEqual({purchasingAreaId, budgetYear: 2027, extension: 50_000});
  });

  it.each([thisYear, thisYear + 1])('can be set for %s', async budgetYear => {
    expect(
      getSomeOrFail(await getTaskEitherRightOrFail(process(budgetYear, 50_000)))
    ).toMatchObject({
      type: 'PurchasingAreaExtensionSet',
      budgetYear,
      extensionPence: 50_000,
    });
  });

  it.each([thisYear - 1, thisYear + 2])("can't be set for %s", async budgetYear => {
    expect(getLeftOrFail(await process(budgetYear, 50_000)())).toMatchObject({
      status: StatusCodes.BAD_REQUEST,
    });
  });

  it('does nothing when it is already that much', async () => {
    await framework.commands.purchasingArea.setExtension(
      command(thisYear + 1, 50_000)
    );
    expect(
      await getTaskEitherRightOrFail(process(thisYear + 1, 50_000))
    ).toStrictEqual(O.none);
  });
});
