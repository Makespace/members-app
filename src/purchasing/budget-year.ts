import {DateTime} from 'luxon';
import {PurchaseRequestOutcome} from '../types/purchase-request-outcome';

// A purchasing area's budget runs for the calendar year, 1 January to
// 31 December, in Makespace's own time zone - so a request submitted just
// after midnight on New Year's Day UK time counts towards the new year.
export const budgetYearOf = (date: Date): number =>
  DateTime.fromJSDate(date, {zone: 'Europe/London'}).year;

// Everything but consumables is spent from the yearly budget. Proposal-needed
// requests count too, as spent this year is every non-consumable request
// submitted in the year (there is no approval step yet to tell funded
// proposals apart).
export const countsAgainstBudget = (outcome: PurchaseRequestOutcome): boolean =>
  outcome !== 'consumable';
