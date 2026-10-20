/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  PurchaseRequestFormViewModel,
  renderSubmitForm,
} from '../../../src/commands/purchase-request/render-submit-form';
import {classifyPurchase} from '../../../src/purchasing/classify-purchase';

const renderToDom = (body: string) => {
  const dom = document.createElement('body');
  dom.innerHTML = body;
  return dom;
};

const text = (page: HTMLElement) => page.textContent.replace(/\s+/g, ' ');

const hidden = (page: HTMLElement) =>
  Object.fromEntries(
    [...page.querySelectorAll<HTMLInputElement>('form input[type="hidden"]')].map(
      input => [input.name, input.value]
    )
  );

const requestId = '33333333-3333-4333-8333-333333333333' as UUID;

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaNames: ['Wood Shop'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

const purchases = [
  {shop: 'Axminster', link: null, items: '2 x blade', costPence: 15_000},
  {shop: 'Toolstation', link: null, items: '1 x guard', costPence: 10_000},
];

const onPage = (
  step: number,
  overrides: Partial<PurchaseRequestFormViewModel> = {}
): PurchaseRequestFormViewModel => ({
  requestId,
  budgetYear: 2026,
  purchasingAreas: [woodShop],
  proposalThresholdPence: 100_000,
  step,
  answers: {
    purchasingAreaId: woodShop.id,
    summary: 'Saw blades',
    justification: 'Blunt',
    purchases: [
      {shop: 'Axminster', items: '2 x blade', cost: '150', link: ''},
      {shop: 'Toolstation', items: '1 x guard', cost: '100', link: ''},
    ],
    isMemberPaidConsumable: 'false',
  },
  problems: [],
  chosen: O.some(woodShop),
  result:
    step === 3
      ? O.some({
          purchases,
          totalPence: 25_000,
          classification: classifyPurchase({
            isMemberPaidConsumable: false,
            amountPence: 25_000,
            yearlyBudgetPence: woodShop.yearlyBudgetPence,
            spentThisYearPence: woodShop.spentThisYearPence,
          }),
        })
      : O.none,
  ...overrides,
});

const render = (viewModel: PurchaseRequestFormViewModel) =>
  renderToDom(renderSubmitForm(viewModel));

describe('purchase request form', () => {
  describe('page 1', () => {
    const page = render(onPage(1));

    it('asks for the area, summary and why, carrying the rest', () => {
      expect(text(page)).toContain('Page 1 of 3');
      expect(page.querySelector('#summary')).not.toBeNull();
      expect(page.querySelector('#justification')).not.toBeNull();
      expect(hidden(page)).toMatchObject({
        step: '2',
        id: requestId,
        'purchases[1][shop]': 'Toolstation',
        isMemberPaidConsumable: 'false',
      });
      expect(hidden(page)).not.toHaveProperty('summary');
    });

    it('moves on to the cost breakdown, with no Back', () => {
      expect(page.querySelector('form button')?.textContent).toContain(
        'Next: Cost breakdown'
      );
      expect(page.querySelector('.step-nav a')).toBeNull();
    });
  });

  describe('page 2', () => {
    it('asks for each shop with its cost, then the consumable question', () => {
      const page = render(onPage(2));
      expect(text(page)).toContain('Page 2 of 3');
      const names = [...page.querySelectorAll('form [name]')].map(field =>
        field.getAttribute('name')
      );
      expect(names.indexOf('purchases[0][cost]')).toBeLessThan(
        names.indexOf('isMemberPaidConsumable')
      );
      expect(
        page.querySelector<HTMLInputElement>('[name="purchases[1][shop]"]')!
          .value
      ).toBe('Toolstation');
      expect(
        page.querySelector<HTMLInputElement>('#consumable-no')!.checked
      ).toBe(true);
      expect(
        page.querySelector<HTMLInputElement>('[name="purchases[0][cost]"]')!
          .required
      ).toBe(true);
      expect(page.querySelector('#estimatedAmount')).toBeNull();
      expect(page.querySelector('.purchase-question')?.textContent).toContain(
        '3D printer filament'
      );
    });

    it('offers blank shops up to three without JavaScript', () => {
      const page = render(
        onPage(2, {
          answers: {...onPage(2).answers, purchases: []},
        })
      );
      expect(page.querySelectorAll('[data-shop-entry]')).toHaveLength(3);
    });

    it('carries page 1, and goes back to it with everything', () => {
      const page = render(onPage(2));
      expect(hidden(page)).toStrictEqual({
        step: '3',
        id: requestId,
        purchasingAreaId: woodShop.id,
        summary: 'Saw blades',
        justification: 'Blunt',
      });
      const back = page.querySelector('.step-nav a')!.getAttribute('href')!;
      const query = new URLSearchParams(back.slice(1));
      expect(query.get('step')).toBe('1');
      expect(query.get('purchases[0][shop]')).toBe('Axminster');
    });
  });

  describe('page 3', () => {
    const page = render(onPage(3));

    it('shows the area budget and the budget it actually comes out of', () => {
      expect(text(page)).toContain('Wood Shop yearly budget');
      expect(text(page)).toContain('For the £250 total');
      expect(text(page)).toContain(
        'This comes out of your yearly budget. No proposal needed.'
      );
      expect(text(page)).toContain('leaving £330.00 of £1,000.00');
    });

    it('lists the shops with the total', () => {
      const rows = [...page.querySelectorAll('.purchase-shops-table tbody tr')];
      expect(rows.map(row => row.textContent.replace(/\s+/g, ' ').trim())).toStrictEqual([
        'Axminster 2 x blade £150',
        'Toolstation 1 x guard £100',
      ]);
      expect(page.querySelector('.purchase-shops-table tfoot')?.textContent).toContain(
        '£250'
      );
    });

    it('sends everything to the submit command', () => {
      const form = page.querySelector<HTMLFormElement>('form[method="post"]')!;
      expect(form.getAttribute('action')).toBe(
        `/purchase-requests/submit?next=${encodeURIComponent(
          `/purchase-requests/view/${requestId}?sent=1`
        )}`
      );
      expect(hidden(page)).toMatchObject({
        id: requestId,
        summary: 'Saw blades',
        'purchases[0][cost]': '150',
        'purchases[1][items]': '1 x guard',
        isMemberPaidConsumable: 'false',
      });
      expect(form.querySelector('button')?.textContent).toContain('Send request');
    });

    it('says when a proposal is needed', () => {
      const proposal = render(
        onPage(3, {
          result: O.some({
            purchases,
            totalPence: 60_000,
            classification: classifyPurchase({
              isMemberPaidConsumable: false,
              amountPence: 60_000,
              yearlyBudgetPence: woodShop.yearlyBudgetPence,
              spentThisYearPence: woodShop.spentThisYearPence,
            }),
          }),
        })
      );
      expect(text(proposal)).toContain("You'll need to write a proposal");
      expect(proposal.querySelector('.purchase-verdict--proposal')).not.toBeNull();
    });
  });

  it('says what still needs sorting out when sent back', () => {
    const page = render(
      onPage(2, {problems: ['Toolstation: please say how much it costs.']})
    );
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Toolstation: please say how much it costs.'
    );
  });

  it('ticks and links back to finished pages', () => {
    const steps = render(onPage(3)).querySelectorAll('.step-progress__step');
    expect(steps[0].querySelector('a')).not.toBeNull();
    expect(steps[2].getAttribute('aria-current')).toBe('step');
  });

  describe('the budget panel', () => {
    const panelFor = (spentThisYearPence: number) => {
      const area = {
        ...woodShop,
        spentThisYearPence,
        remainingPence: woodShop.yearlyBudgetPence - spentThisYearPence,
      };
      return render(
        onPage(3, {purchasingAreas: [area], chosen: O.some(area)})
      ).querySelector<HTMLElement>(`[data-budget-for="${area.id}"]`)!;
    };

    it("shows the area's budget, spend and what is left", () => {
      const values = [...panelFor(42_000).querySelectorAll('dd')].map(
        dd => dd.textContent
      );
      expect(values).toStrictEqual(['£1,000', '£420', '£580']);
    });

    it('leaves out the budget line while under or exactly on budget', () => {
      expect(panelFor(42_000).querySelector('.purchase-bar__limit')).toBeNull();
      expect(panelFor(100_000).querySelector('.purchase-bar__limit')).toBeNull();
    });

    it('marks where the budget ends once spending has gone past it', () => {
      const bar = panelFor(125_000).querySelector('[data-budget-bar]')!;
      const limit = bar.querySelector<HTMLElement>('.purchase-bar__limit');
      expect(limit!.style.left).toBe('calc(80% - 3px)');
      expect(bar.textContent?.replace(/\s+/g, ' ')).toContain('Yearly budget');
    });
  });

  it('explains instead of showing the form to someone who purchases for nothing', () => {
    const page = render(onPage(1, {purchasingAreas: []}));
    expect(page.querySelector('form')).toBeNull();
    expect(page.textContent).toContain("You aren't a purchaser");
  });
});
