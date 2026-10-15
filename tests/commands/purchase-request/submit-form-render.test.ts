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
const craft = {
  id: '22222222-2222-4222-8222-222222222222' as UUID,
  name: 'Craft & Art',
  areaNames: ['Art Space', 'Craft Room'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 88_050,
  remainingPence: 11_950,
};

const viewModel: PurchaseRequestFormViewModel = {
  requestId: '33333333-3333-4333-8333-333333333333' as UUID,
  budgetYear: 2026,
  purchasingAreas: [woodShop, craft],
  preselected: O.some(craft.id),
  proposalThresholdPence: 100_000,
};

describe('purchase request form', () => {
  describe('for a purchaser', () => {
    const page = renderToDom(renderSubmitForm(viewModel));
    const form = page.querySelector('form')!;
    const text = () => page.textContent?.replace(/\s+/g, ' ') ?? '';

    it('posts to the submit command and lands on the confirmation', () => {
      expect(form.getAttribute('action')).toBe(
        `/purchase-requests/submit?next=${encodeURIComponent(
          `/purchase-requests/view/${viewModel.requestId}?sent=1`
        )}`
      );
    });

    it('gives the script the proposal threshold from the server', () => {
      expect(form.dataset.proposalThresholdPence).toBe('100000');
    });

    it('offers the purchasing areas as radios, with the requested one chosen', () => {
      const radios = [
        ...form.querySelectorAll<HTMLInputElement>(
          'input[type="radio"][name="purchasingAreaId"]'
        ),
      ];
      expect(radios.map(radio => radio.value)).toStrictEqual([
        woodShop.id,
        craft.id,
      ]);
      expect(radios.map(radio => radio.checked)).toStrictEqual([false, true]);
      expect(radios[1].dataset.budgetPence).toBe('100000');
      expect(radios[1].dataset.spentPence).toBe('88050');
    });

    it('says which areas share a budget', () => {
      expect(text()).toContain('Shared budget: Art Space and Craft Room');
      expect(text()).not.toContain('Shared budget: Wood Shop');
    });

    it("shows each purchasing area's budget, spend and what is left", () => {
      const panel = form.querySelector(`[data-budget-for="${craft.id}"]`)!;
      const values = [...panel.querySelectorAll('dd')].map(dd =>
        dd.textContent?.trim()
      );
      expect(values).toStrictEqual(['£1,000', '£880.50', '£119.50']);
      expect(panel.querySelector('.purchase-bar__spent')).not.toBeNull();
      expect(panel.querySelector('.purchase-bar__limit')).toBeNull();
      expect(
        form.querySelector(`[data-budget-for="${woodShop.id}"]`)
      ).not.toBeNull();
    });

    it('asks for the estimate before the consumable question and the specifics', () => {
      const names = [...form.querySelectorAll('[name]')].map(field =>
        field.getAttribute('name')
      );
      expect(names.indexOf('estimatedAmount')).toBeLessThan(
        names.indexOf('isMemberPaidConsumable')
      );
      expect(names.indexOf('isMemberPaidConsumable')).toBeLessThan(
        names.indexOf('summary')
      );
    });

    it('asks only whether it is a consumable, with an example', () => {
      const radios = form.querySelectorAll<HTMLInputElement>(
        '.fieldset-item input[type="radio"][name="isMemberPaidConsumable"]'
      );
      expect([...radios].map(radio => radio.value)).toStrictEqual([
        'true',
        'false',
      ]);
      expect(radios[0].required).toBe(true);
      expect(
        form.querySelector('[data-consumable-question]')?.textContent
      ).toContain('3D printer filament');
      expect(form.querySelector('[data-consumable-question] details')).toBeNull();
      expect(form.querySelector('[name="isOperations"]')).toBeNull();
    });

    it('leaves room for the verdict, which the script fills in', () => {
      expect(form.querySelector('[data-verdict]')).not.toBeNull();
    });

    it('offers three shop entries without JavaScript, requiring only the first', () => {
      const shops = form.querySelectorAll<HTMLInputElement>(
        'input[name$="[shop]"]'
      );
      expect([...shops].map(shop => shop.name)).toStrictEqual([
        'purchases[0][shop]',
        'purchases[1][shop]',
        'purchases[2][shop]',
      ]);
      expect([...shops].map(shop => shop.required)).toStrictEqual([
        true,
        false,
        false,
      ]);
      for (const field of ['items', 'link', 'cost']) {
        expect(
          form.querySelector(`[name="purchases[2][${field}]"]`)
        ).not.toBeNull();
      }
    });

    it('asks why it is needed and sends', () => {
      expect(form.querySelector('textarea[name="justification"]')).not.toBeNull();
      expect(form.querySelector('button[type="submit"]')?.textContent).toContain(
        'Send request'
      );
    });

    it('leaves out the prototype-only parts', () => {
      expect(text()).not.toContain('Prototype');
    });
  });

  describe('the budget bar', () => {
    const barFor = (spentThisYearPence: number) => {
      const area = {
        ...woodShop,
        spentThisYearPence,
        remainingPence: woodShop.yearlyBudgetPence - spentThisYearPence,
      };
      const page = renderToDom(
        renderSubmitForm({...viewModel, purchasingAreas: [area]})
      );
      return page.querySelector<HTMLElement>(
        `[data-budget-for="${area.id}"] [data-budget-bar]`
      )!;
    };

    it('leaves out the budget line while under budget', () => {
      const bar = barFor(42_000);
      expect(bar.querySelector('.purchase-bar__limit')).toBeNull();
      expect(bar.textContent).not.toContain('Yearly budget');
    });

    it('leaves out the budget line when exactly on budget', () => {
      expect(barFor(100_000).querySelector('.purchase-bar__limit')).toBeNull();
    });

    it('marks where the budget ends once spending has gone past it', () => {
      const bar = barFor(125_000);
      const limit = bar.querySelector<HTMLElement>('.purchase-bar__limit');
      expect(limit).not.toBeNull();
      expect(limit!.style.left).toBe('calc(80% - 3px)');
      expect(bar.textContent?.replace(/\s+/g, ' ')).toContain('Yearly budget');
    });
  });

  describe('for someone who purchases for nothing', () => {
    const page = renderToDom(
      renderSubmitForm({...viewModel, purchasingAreas: []})
    );

    it('explains instead of showing the form', () => {
      expect(page.querySelector('form')).toBeNull();
      expect(page.textContent).toContain("You aren't a purchaser");
    });
  });
});
