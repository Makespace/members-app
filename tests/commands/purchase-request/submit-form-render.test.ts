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
  {
    shop: 'jewson.co.uk',
    items: [
      {
        url: 'https://www.jewson.co.uk/p/plywood-PEGF8418',
        sku: 'PEGF8418',
        quantity: 1,
        unitPricePence: 5_000,
        notes: null,
      },
      {
        url: null,
        sku: 'PBJT4750',
        quantity: 4,
        unitPricePence: 2_500,
        notes: '4.8m',
      },
    ],
    deliveryPence: 10_000,
  },
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
      {
        shop: 'jewson.co.uk',
        delivery: '100',
        items: [
          {
            url: 'https://www.jewson.co.uk/p/plywood-PEGF8418',
            sku: 'PEGF8418',
            quantity: '1',
            price: '50',
            notes: '',
          },
          {url: '', sku: 'PBJT4750', quantity: '4', price: '25', notes: '4.8m'},
        ],
      },
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
        'purchases[0][shop]': 'jewson.co.uk',
        'purchases[0][items][1][notes]': '4.8m',
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
    it('asks for the shop, then each item from it, then the consumable question', () => {
      const page = render(onPage(2));
      expect(text(page)).toContain('Page 2 of 3');
      const names = [...page.querySelectorAll('form [name]')].map(field =>
        field.getAttribute('name')
      );
      expect(names).toEqual(
        expect.arrayContaining([
          'purchases[0][shop]',
          'purchases[0][delivery]',
          'purchases[0][items][0][url]',
          'purchases[0][items][0][sku]',
          'purchases[0][items][0][quantity]',
          'purchases[0][items][0][price]',
          'purchases[0][items][0][notes]',
        ])
      );
      expect(names.indexOf('purchases[0][items][0][price]')).toBeLessThan(
        names.indexOf('isMemberPaidConsumable')
      );
      expect(
        page.querySelector<HTMLInputElement>(
          '[name="purchases[0][items][1][notes]"]'
        )!.value
      ).toBe('4.8m');
      expect(
        page.querySelector<HTMLInputElement>('#consumable-no')!.checked
      ).toBe(true);
    });

    it('needs the first shop, quantity and price', () => {
      const page = render(onPage(2));
      const required = (name: string) =>
        page.querySelector<HTMLInputElement>(`[name="${name}"]`)!.required;
      expect(required('purchases[0][shop]')).toBe(true);
      expect(required('purchases[0][items][0][quantity]')).toBe(true);
      expect(required('purchases[0][items][0][price]')).toBe(true);
      expect(required('purchases[0][items][0][sku]')).toBe(false);
    });

    it('offers blank shops and items without JavaScript', () => {
      const page = render(
        onPage(2, {answers: {...onPage(2).answers, purchases: []}})
      );
      const shops = page.querySelectorAll('[data-shop-entry]');
      expect(shops).toHaveLength(2);
      expect(shops[0].querySelectorAll('[data-item-entry]')).toHaveLength(3);
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
      expect(query.get('purchases[0][items][0][sku]')).toBe('PEGF8418');
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

    it('lists each shop and its items with the total', () => {
      const rows = [...page.querySelectorAll('.purchase-breakdown tbody tr')];
      expect(
        rows.map(row => row.textContent.replace(/\s+/g, ' ').trim())
      ).toStrictEqual([
        'jewson.co.uk',
        'jewson.co.uk PEGF8418 1 £50.00 £50.00',
        'PBJT4750 4.8m 4 £25.00 £100.00',
        'Delivery £100.00',
        'jewson.co.uk total £250.00',
      ]);
      expect(
        page.querySelector('.purchase-breakdown a')?.getAttribute('href')
      ).toBe('https://www.jewson.co.uk/p/plywood-PEGF8418');
      expect(
        page.querySelector('.purchase-breakdown tfoot')?.textContent
      ).toContain('£250.00');
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
        'purchases[0][delivery]': '100',
        'purchases[0][items][0][price]': '50',
        'purchases[0][items][1][quantity]': '4',
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
      onPage(2, {
        problems: ['jewson.co.uk, item 2: please say how much each one costs.'],
      })
    );
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'jewson.co.uk, item 2: please say how much each one costs.'
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
