import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {rename} from '../../../src/commands/purchasing-area/rename';
import {setBudget} from '../../../src/commands/purchasing-area/set-budget';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('rename and set budget of a purchasing area', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the purchasing area does not exist', () => {
    it('cannot be renamed', async () => {
      const result = getLeftOrFail(
        await rename.process({
          command: {
            purchasingAreaId,
            name: 'Wood' as NonEmptyString,
            actor: arbitraryActor(),
          },
          rm: framework.sharedReadModel,
        })()
      );
      expect(result).toMatchObject({status: StatusCodes.NOT_FOUND});
    });

    it('cannot have its budget set', async () => {
      const result = getLeftOrFail(
        await setBudget.process({
          command: {purchasingAreaId, yearlyBudget: 100, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })()
      );
      expect(result).toMatchObject({
        message: 'The requested purchasing area does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });
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
        })
      );
    });

    it('renames it', async () => {
      const result = await getTaskEitherRightOrFail(
        rename.process({
          command: {
            purchasingAreaId,
            name: 'Woodwork' as NonEmptyString,
            actor: arbitraryActor(),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'PurchasingAreaRenamed',
            purchasingAreaId,
            name: 'Woodwork',
          })
        )
      );
    });

    it('does nothing when renamed to the same name', async () => {
      const result = await getTaskEitherRightOrFail(
        rename.process({
          command: {
            purchasingAreaId,
            name: 'Wood Shop' as NonEmptyString,
            actor: arbitraryActor(),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(O.none);
    });

    it('sets a new budget in pence', async () => {
      const result = await getTaskEitherRightOrFail(
        setBudget.process({
          command: {
            purchasingAreaId,
            yearlyBudget: 125_050,
            actor: arbitraryActor(),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'PurchasingAreaBudgetSet',
            purchasingAreaId,
            yearlyBudgetPence: 125_050,
          })
        )
      );
    });

    it('does nothing when the budget is unchanged', async () => {
      const result = await getTaskEitherRightOrFail(
        setBudget.process({
          command: {
            purchasingAreaId,
            yearlyBudget: 100_000,
            actor: arbitraryActor(),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(O.none);
    });
  });
});
