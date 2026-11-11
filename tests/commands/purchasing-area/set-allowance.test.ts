import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {StatusCodes} from 'http-status-codes';
import {setAllowance} from '../../../src/commands/purchasing-area/set-allowance';
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

describe('set the yearly allowance per Area', () => {
  let framework: TestFramework;
  const command = (fromBudgetYear: number, allowancePerArea: number) => ({
    fromBudgetYear,
    allowancePerArea,
    actor: arbitraryActor(),
  });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('reads the year and an amount in pounds', () => {
    expect(
      getRightOrFail(
        setAllowance.decode({fromBudgetYear: '2027', allowancePerArea: '1000.00'})
      )
    ).toStrictEqual({fromBudgetYear: 2027, allowancePerArea: 100_000});
  });

  it('refuses nothing at all', () => {
    expect(
      E.isLeft(setAllowance.decode({fromBudgetYear: '2027', allowancePerArea: '0'}))
    ).toBe(true);
  });

  it('refuses a year that is not a year', async () => {
    expect(
      getLeftOrFail(
        await setAllowance.process({
          command: command(27, 100_000) as never,
          rm: framework.sharedReadModel,
        })()
      )
    ).toMatchObject({status: StatusCodes.BAD_REQUEST});
  });

  it('sets it from that year', async () => {
    await framework.commands.purchasingArea.setAllowance(
      command(2027, 100_000) as never
    );
    expect(framework.sharedReadModel.purchasing.allowances()).toStrictEqual([
      {fromBudgetYear: 2027, allowancePerAreaPence: 100_000},
    ]);
  });

  it('does nothing when that year already has that allowance', async () => {
    await framework.commands.purchasingArea.setAllowance(
      command(2027, 100_000) as never
    );
    expect(
      await getTaskEitherRightOrFail(
        setAllowance.process({
          command: command(2027, 100_000) as never,
          rm: framework.sharedReadModel,
        })
      )
    ).toStrictEqual(O.none);
  });
});
