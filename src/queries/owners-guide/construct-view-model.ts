import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  PurchaseRequest,
  PurchasingAreaPurchaser,
} from '../../read-models/shared-state/return-types';
import {DateTime} from 'luxon';
import {countsAgainstBudget} from '../../purchasing/budget-year';
import {User} from '../../types';

export type PurchasingAreaOfYours = {
  id: UUID;
  name: string;
  // Only the reader's own areas it covers, by name.
  yourAreas: ReadonlyArray<string>;
  // Until a super user activates it, it takes no purchase requests.
  active: boolean;
  // This budget year's.
  yearlyBudgetPence: number;
  // Negative once overspent.
  remainingPence: number;
  // Purchase requests bought this budget year, after approval or directly.
  purchasesThisYear: number;
  // What was spent against the budget in each month of the budget year,
  // January first: requests approved or bought, by when they were made.
  // Spending recorded by hand isn't in it.
  spentByMonthPence: ReadonlyArray<number>;
  purchasers: ReadonlyArray<PurchasingAreaPurchaser>;
};

// What the guide shows about a logged-in reader's own areas.
export type YourAreas = {
  // This month of the budget year, 1 for January: the months after it
  // haven't happened yet.
  monthNow: number;
  // The purchasing areas the reader's areas are in, by name.
  purchasingAreas: ReadonlyArray<PurchasingAreaOfYours>;
  // Areas the reader owns that are in no purchasing area yet, by name.
  withoutPurchasingArea: ReadonlyArray<string>;
};

// The guide is open to anybody; only a logged-in reader has areas of their
// own to show.
export type ViewModel = {
  reader: O.Option<YourAreas>;
};

export const loggedOut: ViewModel = {reader: O.none};

const bought = new Set<PurchaseRequest['status']>([
  'bought',
  'bought-directly',
]);

const spent = new Set<PurchaseRequest['status']>([
  'approved',
  'bought',
  'bought-directly',
]);

const spentByMonth = (requests: ReadonlyArray<PurchaseRequest>) => {
  const months = Array.from({length: 12}, () => 0);
  for (const request of requests) {
    if (spent.has(request.status) && countsAgainstBudget(request.outcome)) {
      const month = DateTime.fromJSDate(request.submittedAt, {
        zone: 'Europe/London',
      }).month;
      months[month - 1] += pipe(
        request.actualCostPence,
        O.getOrElse(() => request.totalPence)
      );
    }
  }
  return months;
};

const byName = (a: {name: string}, b: {name: string}) =>
  a.name.localeCompare(b.name);

export const constructViewModel = (
  rm: SharedReadModel,
  user: User,
  now: Date = new Date()
): ViewModel => {
  const owned = pipe(
    rm.members.getByMemberNumber(user.memberNumber),
    O.match(
      () => [],
      member => [...member.ownerOf]
    )
  ).sort(byName);

  const purchasingAreas = new Map<string, PurchasingAreaOfYours>();
  const withoutPurchasingArea: string[] = [];
  for (const area of owned) {
    const purchasingArea = pipe(
      rm.purchasing.getForArea(area.id as UUID),
      O.chain(summary => rm.purchasing.get(summary.id, now))
    );
    if (O.isNone(purchasingArea)) {
      withoutPurchasingArea.push(area.name);
      continue;
    }
    const {
      id,
      name,
      purchasers,
      active,
      yearlyBudgetPence,
      remainingPence,
      budgetYear,
    } = purchasingArea.value;
    const requests = rm.purchasing.getRequests(id, budgetYear);
    const existing = purchasingAreas.get(id);
    purchasingAreas.set(id, {
      id,
      name,
      active,
      yearlyBudgetPence,
      remainingPence,
      purchasesThisYear: requests.filter(request =>
        bought.has(request.status)
      ).length,
      spentByMonthPence: spentByMonth(requests),
      purchasers,
      yourAreas: [...(existing?.yourAreas ?? []), area.name],
    });
  }

  return {
    reader: O.some({
      monthNow: DateTime.fromJSDate(now, {zone: 'Europe/London'}).month,
      purchasingAreas: [...purchasingAreas.values()].sort(byName),
      withoutPurchasingArea,
    }),
  };
};
