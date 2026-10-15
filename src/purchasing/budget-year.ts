import {DateTime} from 'luxon';
import {PurchaseRequestOutcome} from '../types/purchase-request-outcome';

// A purchasing area's budget runs for the calendar year, 1 January to
// 31 December, in Makespace's own time zone - so a request submitted just
// after midnight on New Year's Day UK time counts towards the new year.
export const budgetYearOf = (date: Date): number =>
  DateTime.fromJSDate(date, {zone: 'Europe/London'}).year;

// Only CapEx is spent from the yearly budget; OpEx is recorded but not
// counted. Proposal-needed CapEx counts too, as the brief defines spent this
// year as every CapEx request submitted in the year (there is no approval
// step yet to tell funded proposals apart).
export const countsAgainstBudget = (outcome: PurchaseRequestOutcome): boolean =>
  outcome === 'capex-from-budget' || outcome === 'capex-proposal-needed';
