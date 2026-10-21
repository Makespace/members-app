import {
  budgetYearOf,
  countsAgainstBudget,
} from '../../src/purchasing/budget-year';

describe('budgetYearOf', () => {
  it('is the calendar year', () => {
    expect(budgetYearOf(new Date('2026-06-15T12:00:00Z'))).toStrictEqual(2026);
  });

  it('starts the year at midnight UK time', () => {
    // 23:30 on 31 December UTC is still 2026 in London (GMT in winter).
    expect(budgetYearOf(new Date('2026-12-31T23:30:00Z'))).toStrictEqual(2026);
    expect(budgetYearOf(new Date('2027-01-01T00:00:00Z'))).toStrictEqual(2027);
  });
});

describe('countsAgainstBudget', () => {
  it('counts everything from the budget, proposals included', () => {
    expect(countsAgainstBudget('budget')).toBe(true);
    expect(countsAgainstBudget('budget-proposal-needed')).toBe(true);
  });

  it('does not count consumables', () => {
    expect(countsAgainstBudget('consumable')).toBe(false);
  });
});
