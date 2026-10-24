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
  status: 'awaiting-approval',
  decidedAt: O.none,
  decidedByMemberNumber: O.none,
  declineReason: O.none,
  approvalNote: O.none,
  boughtAt: O.none,
  boughtByMemberNumber: O.none,
  actualCostPence: O.none,
  outcome: 'budget',
  approval: 'none',
  outcomeReason: 'This comes out of the yearly budget.',
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
};

const page = (
  justSent: boolean,
  overrides: Partial<PurchaseRequest> = {},
  canDecide = false
) =>
  render({
    justSent,
    request: {...request, ...overrides},
    purchasingArea: O.some({id: request.purchasingAreaId, name: 'Wood Shop'}),
    submitterName: O.some('Ada Admin'),
    deciderName: O.some('Dee Director'),
    buyerName: O.some('Pat Purchaser'),
    canDecide,
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


  it("says a purchaser needs to approve it next, or a director if it needs a proposal", () => {
    expect(page(true).replace(/\s+/g, ' ')).toContain(
      "one of the area's purchasers (or a director) needs to approve this request."
    );
    expect(page(true)).toContain('Awaiting purchaser approval');
    expect(
      page(true, {outcome: 'budget-proposal-needed', approval: 'proposal'}).replace(
        /\s+/g,
        ' '
      )
    ).toContain('a director needs to approve this request and its proposal.');
  });

  it('offers Approve and Decline only to super users, while it awaits approval', () => {
    expect(page(false, {}, true)).toContain(
      `href="/purchase-requests/approve?request=${request.id}"`
    );
    expect(page(false, {}, true)).toContain(
      `href="/purchase-requests/decline?request=${request.id}"`
    );
    expect(page(false)).not.toContain('/purchase-requests/approve');
    expect(page(false, {status: 'approved'}, true)).not.toContain(
      '/purchase-requests/approve'
    );
  });

  it('says a proposal is needed only while it awaits approval', () => {
    const proposal = {outcome: 'budget-proposal-needed', approval: 'proposal'} as const;
    expect(page(false, proposal)).toContain('Yearly budget · Proposal needed');
    expect(page(false, {...proposal, status: 'approved'})).toContain(
      'Yearly budget · Proposal approved'
    );
    expect(page(false, {...proposal, status: 'declined'})).not.toContain(
      'Proposal'
    );
  });

  it('says who approved or declined it, and why it was declined', () => {
    expect(
      page(false, {
        status: 'approved',
        decidedAt: O.some(new Date('2026-10-16T09:00:00Z')),
      }).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')
    ).toContain('Approved (purchaser approval) by Dee Director');
    expect(
      page(false, {
        status: 'declined',
        declineReason: O.some('No budget left this year'),
      }).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')
    ).toContain('Declined by Dee Director');
    expect(
      page(false, {
        status: 'declined',
        declineReason: O.some('No budget left this year'),
      })
    ).toContain('No budget left this year');
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
        risks: [
          {
            hazard: 'Kickback',
            harm: 'The user',
            severity: 4,
            probability: 3,
            actions: 'Guards',
            residualSeverity: 4,
            residualProbability: 1,
          },
        ],
        location: null,
        owner: 'The wood shop owners',
        trainingAndServicing: null,
      }),
    }).replace(/\s+/g, ' ');
    expect(html).toContain('The planer is unsafe');
    expect(html).toContain('Option 1: Replace it');
    expect(html).toContain('£1,200.00');
    expect(html).toContain('Kickback');
    expect(html).toContain('4 Major × 3 Possible = <strong>12</strong>');
    expect(html).toContain('4 Major × 1 Rare = <strong>4</strong>');
    expect(html).toContain('Who owns it');
    expect(html).not.toContain('Where it goes');
    expect(html).toContain('and its proposal');
    expect(html).not.toContain('write your proposal');
  });

  it('has no proposal section when there is none', () => {
    expect(page(true)).not.toContain('Proposal</h2>');
  });
});
