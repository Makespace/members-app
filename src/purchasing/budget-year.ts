import {DateTime} from 'luxon';
import {PurchaseRequestOutcome} from '../types/purchase-request-outcome';

// A purchasing area's budget runs for the calendar year, 1 January to
// 31 December, in Makespace's own time zone - so a request submitted just
// after midnight on New Year's Day UK time counts towards the new year.
export const budgetYearOf = (date: Date): number =>
  DateTime.fromJSDate(date, {zone: 'Europe/London'}).year;

// Everything members don't pay for comes out of the yearly budget - once a
// super user has approved it; see the purchasing read model.
export const countsAgainstBudget = (outcome: PurchaseRequestOutcome): boolean =>
  outcome !== 'consumable';
