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
  totalPence: 15_000,
  purchases: [
    {
      shop: 'Axminster Tools',
      items: [
        {
          url: 'https://www.axminstertools.com/blade',
          sku: 'AX123',
          quantity: 2,
          costPence: 12_000,
          notes: '254mm',
        },
      ],
      deliveryPence: 3_000,
    },
  ],
  justification: 'The old blades are blunt',
  isMemberPaidConsumable: false,
  affectedAreaIds: [],
  healthAndSafetyRisk: false,
  proposal: O.none,
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
    expect(html).toContain('href="https://www.axminstertools.com/blade"');
    expect(html).toContain('AX123');
    expect(html).toContain('254mm');
    expect(html).toContain('£120.00');
    expect(html).toContain('Delivery');
    expect(html).toContain('£150.00');
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

  it('shows the proposal it was sent with', () => {
    const html = page(true, {
      approval: 'proposal',
      outcome: 'budget-proposal-needed',
      proposal: O.some({
        need: 'The planer is unsafe',
        options: [
          {description: 'Replace it', pros: 'Safe', cons: 'Dear', costPence: 120_000},
        ],
        preferred: 'Replace it',
        risks: [{hazard: 'Kickback', harm: 'The user', actions: 'Guards'}],
        location: null,
        owner: 'The wood shop owners',
        trainingAndServicing: null,
      }),
    }).replace(/\s+/g, ' ');
    expect(html).toContain('The planer is unsafe');
    expect(html).toContain('Option 1: Replace it');
    expect(html).toContain('£1,200.00');
    expect(html).toContain('Kickback');
    expect(html).toContain('Who owns it');
    expect(html).not.toContain('Where it goes');
    expect(html).toContain('the proposal needs agreeing');
    expect(html).not.toContain('write your proposal');
  });

  it('has no proposal section when there is none', () => {
    expect(page(true)).not.toContain('Proposal</h2>');
  });
});
