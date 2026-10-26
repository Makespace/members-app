import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import { UUID} from 'io-ts-types';
import {constructEvent, DomainEvent} from '../../../src/types';
import {DomainEvent as DomainEventCodec} from '../../../src/types/domain-event';
import {setYearBudget} from '../../../src/commands/purchasing-area/set-year-budget';
import {setBudget} from '../../../src/commands/purchasing-area/set-budget';
import {removeSpend} from '../../../src/commands/purchasing-area/remove-spend';
import {budgetYearOf} from '../../../src/purchasing/budget-year';
import {
  arbitraryActor,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// Super users adjusting a purchasing area's year: this year's own budget
// (e.g. an extension) and spending recorded outside purchase requests.
describe('purchasing area budget adjustments', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const thisYear = budgetYearOf(new Date());
  const actor = arbitraryActor();

  const insert = (...events: DomainEvent[]) =>
    events.forEach(event => framework.insertIntoSharedReadModel(event));
  const area = () =>
    getSomeOrFail(framework.sharedReadModel.purchasing.get(purchasingAreaId, new Date()));
  const rm = () => framework.sharedReadModel;

  beforeEach(async () => {
    framework = await initTestFramework();
    insert(
      constructEvent('PurchasingAreaCreated')({
        actor,
        id: purchasingAreaId,
        name: 'Wood Shop',
        yearlyBudgetPence: 200_000,
        active: true,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe("this year's budget", () => {
    it('is set for this year only', async () => {
      const event = getSomeOrFail(
        await getTaskEitherRightOrFail(
          setYearBudget.process({
            command: {purchasingAreaId, yearlyBudget: 500_000, actor},
            rm: rm(),
          })
        )
      );
      expect(event).toMatchObject({
        type: 'PurchasingAreaYearBudgetSet',
        purchasingAreaId,
        budgetYear: thisYear,
        yearlyBudgetPence: 500_000,
      });
    });

    it('replaces the usual budget this year, leaving the usual one alone', () => {
      insert(
        constructEvent('PurchasingAreaYearBudgetSet')({
          actor,
          purchasingAreaId,
          budgetYear: thisYear,
          yearlyBudgetPence: 500_000,
        })
      );
      expect(area()).toMatchObject({
        yearlyBudgetPence: 500_000,
        usualBudgetPence: 200_000,
        remainingPence: 500_000,
      });
    });

    it("doesn't apply to another year", () => {
      insert(
        constructEvent('PurchasingAreaYearBudgetSet')({
          actor,
          purchasingAreaId,
          budgetYear: thisYear - 1,
          yearlyBudgetPence: 500_000,
        })
      );
      expect(area().yearlyBudgetPence).toBe(200_000);
    });

    it('can be set again, the latest winning', () => {
      insert(
        constructEvent('PurchasingAreaYearBudgetSet')({
          actor,
          purchasingAreaId,
          budgetYear: thisYear,
          yearlyBudgetPence: 500_000,
        }),
        constructEvent('PurchasingAreaYearBudgetSet')({
          actor,
          purchasingAreaId,
          budgetYear: thisYear,
          yearlyBudgetPence: 300_000,
        })
      );
      expect(area().yearlyBudgetPence).toBe(300_000);
    });

    it('does nothing when it is already that', async () => {
      expect(
        await getTaskEitherRightOrFail(
          setYearBudget.process({
            command: {purchasingAreaId, yearlyBudget: 200_000, actor},
            rm: rm(),
          })
        )
      ).toStrictEqual(O.none);
    });

    it('leaves the usual budget to be changed on its own', async () => {
      insert(
        constructEvent('PurchasingAreaYearBudgetSet')({
          actor,
          purchasingAreaId,
          budgetYear: thisYear,
          yearlyBudgetPence: 500_000,
        })
      );
      const event = await getTaskEitherRightOrFail(
        setBudget.process({
          command: {purchasingAreaId, yearlyBudget: 500_000, actor},
          rm: rm(),
        })
      );
      expect(getSomeOrFail(event)).toMatchObject({
        type: 'PurchasingAreaBudgetSet',
        yearlyBudgetPence: 500_000,
      });
    });
  });

  describe('recorded spending', () => {
    // Recorded by super users before purchases went through the app; new
    // spending goes through the request form instead.
    const spendId = faker.string.uuid() as UUID;

    describe('once recorded', () => {
      beforeEach(() => {
        insert(
          constructEvent('PurchasingAreaSpendRecorded')({
            actor,
            id: spendId,
            purchasingAreaId,
            budgetYear: thisYear,
            amountPence: 300_000,
            description: 'Spending before requests were in the app',
            kind: 'budget',
          })
        );
      });

      it('counts as spent this year and is listed', () => {
        expect(area()).toMatchObject({
          spentThisYearPence: 300_000,
          remainingPence: -100_000,
          recordedSpend: [
            expect.objectContaining({
              id: spendId,
              amountPence: 300_000,
              description: 'Spending before requests were in the app',
            }),
          ],
        });
      });

      it('can be removed, no longer counting', async () => {
        const removal = getSomeOrFail(
          await getTaskEitherRightOrFail(
            removeSpend.process({
              command: {purchasingAreaId, id: spendId, actor},
              rm: rm(),
            })
          )
        );
        expect(removal).toMatchObject({type: 'PurchasingAreaSpendRemoved', id: spendId});
        insert(removal);
        expect(area()).toMatchObject({spentThisYearPence: 0, recordedSpend: []});
      });
    });

    it("doesn't count spending recorded for another year", () => {
      insert(
        constructEvent('PurchasingAreaSpendRecorded')({
          actor,
          id: faker.string.uuid() as UUID,
          purchasingAreaId,
          budgetYear: thisYear - 1,
          amountPence: 50_000,
          description: 'Last year',
          kind: 'budget',
        })
      );
      expect(area().spentThisYearPence).toBe(0);
    });

    it('has nothing to remove when it was never recorded', async () => {
      expect(
        await getTaskEitherRightOrFail(
          removeSpend.process({
            command: {purchasingAreaId, id: faker.string.uuid() as UUID, actor},
            rm: rm(),
          })
        )
      ).toStrictEqual(O.none);
    });
  });

  describe('approved spending outside the budget', () => {
    beforeEach(() => {
      insert(
        constructEvent('PurchasingAreaSpendRecorded')({
          actor,
          id: faker.string.uuid() as UUID,
          purchasingAreaId,
          budgetYear: thisYear,
          amountPence: 100_000,
          description: 'Extraction repair, approved by the directors',
          kind: 'approved',
        })
      );
    });

    it("is listed, but doesn't use up the budget", () => {
      expect(area()).toMatchObject({
        spentThisYearPence: 0,
        remainingPence: 200_000,
        approvedSpendThisYearPence: 100_000,
        recordedSpend: [
          expect.objectContaining({
            amountPence: 100_000,
            kind: 'approved',
          }),
        ],
      });
    });
  });

  it('reads spending recorded before approved spending existed as out of the budget', () => {
    const recorded = DomainEventCodec.decode({
      type: 'PurchasingAreaSpendRecorded',
      actor,
      recordedAt: new Date().toISOString(),
      id: faker.string.uuid(),
      purchasingAreaId,
      budgetYear: thisYear,
      amountPence: 300_000,
      description: 'Before requests were in the app',
    });
    const event = getRightOrFail(recorded);
    expect(event).toMatchObject({kind: 'budget'});
    insert(event);
    expect(area().spentThisYearPence).toBe(300_000);
  });
});
