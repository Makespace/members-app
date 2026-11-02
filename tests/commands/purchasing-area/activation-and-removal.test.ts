import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {
  activate,
  deactivate,
} from '../../../src/commands/purchasing-area/activation';
import {remove} from '../../../src/commands/purchasing-area/remove';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('activating, deactivating and removing a purchasing area', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const command = () => ({purchasingAreaId, actor: arbitraryActor()});

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the purchasing area does not exist', () => {
    it('cannot be activated', async () => {
      const result = getLeftOrFail(
        await activate.process({
          command: command(),
          rm: framework.sharedReadModel,
        })()
      );
      expect(result).toMatchObject({status: StatusCodes.NOT_FOUND});
    });

    it('cannot be removed', async () => {
      const result = getLeftOrFail(
        await remove.process({
          command: command(),
          rm: framework.sharedReadModel,
        })()
      );
      expect(result).toMatchObject({status: StatusCodes.NOT_FOUND});
    });
  });

  describe('when the purchasing area is not active', () => {
    beforeEach(() => {
      framework.insertIntoSharedReadModel(
        constructEvent('PurchasingAreaCreated')({
          actor: arbitraryActor(),
          id: purchasingAreaId,
          name: 'Wood Shop',
          yearlyBudgetPence: 100_000,
          active: false,
        })
      );
    });

    it('activates it', async () => {
      const result = await getTaskEitherRightOrFail(
        activate.process({command: command(), rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'PurchasingAreaActivated',
            purchasingAreaId,
          })
        )
      );
    });

    it('does nothing when deactivated', async () => {
      const result = await getTaskEitherRightOrFail(
        deactivate.process({command: command(), rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the purchasing area is active', () => {
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

    it('deactivates it', async () => {
      const result = await getTaskEitherRightOrFail(
        deactivate.process({command: command(), rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'PurchasingAreaDeactivated',
            purchasingAreaId,
          })
        )
      );
    });

    it('does nothing when activated', async () => {
      const result = await getTaskEitherRightOrFail(
        activate.process({command: command(), rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(O.none);
    });

    describe('with nothing requested or recorded against it', () => {
      it('removes it', async () => {
        const result = await getTaskEitherRightOrFail(
          remove.process({command: command(), rm: framework.sharedReadModel})
        );
        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'PurchasingAreaRemoved',
              purchasingAreaId,
            })
          )
        );
      });
    });

    describe('with spending recorded against it', () => {
      beforeEach(() => {
        framework.insertIntoSharedReadModel(
          constructEvent('PurchasingAreaSpendRecorded')({
            actor: arbitraryActor(),
            id: faker.string.uuid() as UUID,
            purchasingAreaId,
            budgetYear: 2025,
            amountPence: 5_000,
            description: 'Saw blades',
            kind: 'budget',
          })
        );
      });

      it('refuses to remove it', async () => {
        const result = getLeftOrFail(
          await remove.process({
            command: command(),
            rm: framework.sharedReadModel,
          })()
        );
        expect(result).toMatchObject({status: StatusCodes.BAD_REQUEST});
      });
    });
  });
});
