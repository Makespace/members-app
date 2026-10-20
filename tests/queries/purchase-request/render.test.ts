import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/purchase-request/render';
import {PurchaseRequest} from '../../../src/read-models/shared-state/return-types';

const request: PurchaseRequest = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  purchasingAreaId: '22222222-2222-4222-8222-222222222222' as UUID,
  submittedByMemberNumber: 1337,
  submittedAt: new Date('2026-10-15T12:00:00Z'),
  budgetYear: 2026,
  summary: 'Table saw blades',
  estimatedAmountPence: 18_500,
  totalPence: 15_000,
  purchases: [
    {
      shop: 'Axminster Tools',
      link: O.some('https://www.axminstertools.com/'),
      items: '2 x blade\n1 x guard',
      costPence: 15_000,
    },
  ],
  justification: 'The old blades are blunt',
  isMemberPaidConsumable: false,
  outcome: 'budget',
  approval: 'none',
  outcomeReason: 'This comes out of the yearly budget.',
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
};

const page = (justSent: boolean, overrides: Partial<PurchaseRequest> = {}) =>
  render({
    justSent,
    request: {...request, ...overrides},
    purchasingArea: O.some({id: request.purchasingAreaId, name: 'Wood Shop'}),
    submitterName: O.some('Ada Admin'),
  });

describe('purchase request page', () => {
  it('confirms a request just sent', () => {
    const html = page(true);
    expect(html).toContain('Request sent');
    expect(html).toContain('Table saw blades · £150.00 · Wood Shop');
  });

  it('heads a request looked at later with its summary', () => {
    expect(page(false)).not.toContain('Request sent');
  });

  it("shows the budget and this year's spend once it was counted", () => {
    const html = page(true);
    expect(html).toContain('Yearly budget');
    expect(html).toContain('£570.00 of £1,000.00');
  });

  it('lists each shop with its items and cost', () => {
    const html = page(true);
    expect(html).toContain('href="https://www.axminstertools.com/"');
    expect(html).toContain('2 x blade\n1 x guard');
    expect(html).toContain('£150.00');
    expect(html).toContain('The shops add up to');
    const text = html.replace(/\s+/g, ' ');
    expect(text).toContain('less than the £185.00 estimate');
    expect(text).toContain('The shop total is what counts');
  });

  it('says nothing about the estimate when the shops match it', () => {
    expect(page(true, {estimatedAmountPence: 15_000})).not.toContain(
      'The shops add up to'
    );
  });

  it('says a proposal comes next when one is needed', () => {
    expect(
      page(true, {outcome: 'budget-proposal-needed', approval: 'proposal'})
    ).toContain('write your proposal');
  });

  it("doesn't add a consumable to this year's spend", () => {
    expect(
      page(true, {outcome: 'consumable', isMemberPaidConsumable: true})
    ).toContain('£420.00 of £1,000.00');
  });
});
