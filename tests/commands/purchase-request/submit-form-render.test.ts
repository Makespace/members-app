/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  PurchaseRequestFormViewModel,
  renderSubmitForm,
} from '../../../src/commands/purchase-request/render-submit-form';

const renderToDom = (body: string) => {
  const dom = document.createElement('body');
  dom.innerHTML = body;
  return dom;
};

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaNames: ['Wood Shop'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

const onBudgetPage = (
  area: typeof woodShop
): PurchaseRequestFormViewModel => ({
  requestId: '33333333-3333-4333-8333-333333333333' as UUID,
  budgetYear: 2026,
  purchasingAreas: [area],
  proposalThresholdPence: 100_000,
  step: 2,
  answers: {
    purchasingAreaId: area.id,
    summary: 'Saw blades',
    justification: 'Blunt',
    estimatedAmount: '',
    isMemberPaidConsumable: '',
  },
  missing: [],
  chosen: O.some(area),
  estimate: O.none,
});

describe('purchase request form', () => {
  describe('the budget panel', () => {
    const panelFor = (spentThisYearPence: number) => {
      const area = {
        ...woodShop,
        spentThisYearPence,
        remainingPence: woodShop.yearlyBudgetPence - spentThisYearPence,
      };
      return renderToDom(renderSubmitForm(onBudgetPage(area))).querySelector<
        HTMLElement
      >(`[data-budget-for="${area.id}"]`)!;
    };

    it("shows the area's budget, spend and what is left", () => {
      const values = [...panelFor(42_000).querySelectorAll('dd')].map(
        dd => dd.textContent
      );
      expect(values).toStrictEqual(['£1,000', '£420', '£580']);
    });

    it('leaves out the budget line while under budget', () => {
      const bar = panelFor(42_000).querySelector('[data-budget-bar]')!;
      expect(bar.querySelector('.purchase-bar__limit')).toBeNull();
      expect(bar.textContent).not.toContain('Yearly budget');
    });

    it('leaves out the budget line when exactly on budget', () => {
      expect(
        panelFor(100_000).querySelector('.purchase-bar__limit')
      ).toBeNull();
    });

    it('marks where the budget ends once spending has gone past it', () => {
      const bar = panelFor(125_000).querySelector('[data-budget-bar]')!;
      const limit = bar.querySelector<HTMLElement>('.purchase-bar__limit');
      expect(limit!.style.left).toBe('calc(80% - 3px)');
      expect(bar.textContent?.replace(/\s+/g, ' ')).toContain('Yearly budget');
    });
  });

  describe('each page', () => {
    const answers = {
      purchasingAreaId: woodShop.id,
      summary: 'Saw blades',
      justification: 'Blunt',
      estimatedAmount: '250',
      isMemberPaidConsumable: 'false',
    };
    const onPage = (step: number) =>
      renderToDom(
        renderSubmitForm({
          ...onBudgetPage(woodShop),
          step,
          answers,
          estimate:
            step === 3
              ? O.some({
                  amountPence: 25_000,
                  classification: {
                    outcome: 'budget',
                    approval: 'none',
                    reason: 'This comes out of the yearly budget.',
                  },
                })
              : O.none,
        })
      );
    const hidden = (page: HTMLElement) =>
      Object.fromEntries(
        [
          ...page.querySelectorAll<HTMLInputElement>('form input[type="hidden"]'),
        ].map(input => [input.name, input.value])
      );
    const text = (page: HTMLElement) =>
      page.textContent.replace(/\s+/g, ' ');

    it('asks for the area, summary and why on page 1, moving on to page 2', () => {
      const page = onPage(1);
      expect(text(page)).toContain('Page 1 of 3');
      const form = page.querySelector('form[method="get"]')!;
      expect(
        [...new Set([...form.querySelectorAll('[name]')].map(f => f.getAttribute('name')))]
      ).toStrictEqual([
        'step',
        'id',
        'estimatedAmount',
        'isMemberPaidConsumable',
        'purchasingAreaId',
        'summary',
        'justification',
      ]);
      expect(hidden(page).step).toBe('2');
      expect(form.querySelector('button')?.textContent).toContain(
        'Next: Budget and estimate'
      );
      expect(page.querySelector('.step-nav a')).toBeNull();
    });

    it("asks for the estimate on page 2, with the chosen area's budget", () => {
      const page = onPage(2);
      expect(text(page)).toContain('Wood Shop yearly budget');
      expect(page.querySelector('#estimatedAmount')).not.toBeNull();
      expect(hidden(page)).toMatchObject({
        step: '3',
        summary: 'Saw blades',
        justification: 'Blunt',
      });
      const back = page.querySelector('.step-nav a')!.getAttribute('href')!;
      expect(new URLSearchParams(back.slice(1)).get('step')).toBe('1');
      expect(new URLSearchParams(back.slice(1)).get('summary')).toBe(
        'Saw blades'
      );
    });

    it('says what the estimate means on page 3, and sends everything', () => {
      const page = onPage(3);
      expect(text(page)).toContain('Based on your £250 estimate');
      expect(text(page)).toContain('Up to £580 needs no proposal.');
      const form = page.querySelector<HTMLFormElement>('form[method="post"]')!;
      expect(form.getAttribute('action')).toBe(
        `/purchase-requests/submit?next=${encodeURIComponent(
          '/purchase-requests/view/33333333-3333-4333-8333-333333333333?sent=1'
        )}`
      );
      expect(hidden(page)).toStrictEqual({
        id: '33333333-3333-4333-8333-333333333333',
        ...answers,
      });
      expect(
        form.querySelector<HTMLInputElement>('[name="purchases[0][cost]"]')!
          .required
      ).toBe(true);
      expect(form.querySelector('button[type="submit"]')?.textContent).toContain(
        'Send request'
      );
    });

    it('says what is missing when sent back', () => {
      const page = renderToDom(
        renderSubmitForm({
          ...onBudgetPage(woodShop),
          step: 1,
          missing: ['a summary', 'why it is needed'],
        })
      );
      expect(page.querySelector('[role="alert"]')?.textContent).toContain(
        'Please give a summary, why it is needed before moving on.'
      );
    });

    it('ticks and links back to finished pages', () => {
      const steps = onPage(3).querySelectorAll('.step-progress__step');
      expect(steps[0].querySelector('a')).not.toBeNull();
      expect(steps[2].getAttribute('aria-current')).toBe('step');
    });
  });

  it('gives the consumable question one example', () => {
    const page = renderToDom(renderSubmitForm(onBudgetPage(woodShop)));
    expect(page.querySelector('.purchase-question')?.textContent).toContain(
      '3D printer filament'
    );
    expect(page.querySelector('.purchase-question details')).toBeNull();
  });

  it('explains instead of showing the form to someone who purchases for nothing', () => {
    const page = renderToDom(
      renderSubmitForm({...onBudgetPage(woodShop), purchasingAreas: []})
    );
    expect(page.querySelector('form')).toBeNull();
    expect(page.textContent).toContain("You aren't a purchaser");
  });
});
