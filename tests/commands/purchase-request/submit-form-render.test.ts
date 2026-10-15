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

const textile = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Textiles',
  areaNames: ['Textiles'],
  yearlyBudgetPence: 150_000,
  spentThisYearPence: 40_000,
  remainingPence: 110_000,
};
const craft = {
  id: '22222222-2222-4222-8222-222222222222' as UUID,
  name: 'Craft & Art',
  areaNames: ['Art Space', 'Craft Room'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 0,
  remainingPence: 100_000,
};

const viewModel: PurchaseRequestFormViewModel = {
  requestId: '33333333-3333-4333-8333-333333333333' as UUID,
  budgetYear: 2026,
  purchasingAreas: [textile, craft],
  preselected: O.some(craft.id),
  proposalThresholdPence: 100_000,
};

describe('purchase request form', () => {
  describe('for a purchaser', () => {
    const page = renderToDom(renderSubmitForm(viewModel));
    const form = page.querySelector('form')!;

    it('posts to the submit command and lands on the new request', () => {
      expect(form.getAttribute('action')).toBe(
        `/purchase-requests/submit?next=${encodeURIComponent(
          `/purchase-requests/view/${viewModel.requestId}`
        )}`
      );
    });

    it("shows each purchasing area's budget, spend and what is left", () => {
      const text = page.textContent ?? '';
      expect(text).toContain('£1,500.00');
      expect(text).toContain('£400.00');
      expect(text).toContain('£1,100.00');
    });

    it('offers only the given purchasing areas, with the requested one chosen', () => {
      const options = [
        ...form.querySelectorAll<HTMLOptionElement>(
          'select[name="purchasingAreaId"] option[value]:not([value=""])'
        ),
      ];
      expect(options.map(option => option.value)).toStrictEqual([
        textile.id,
        craft.id,
      ]);
      expect(options[1].selected).toBe(true);
    });

    it('asks for the estimate before the specifics', () => {
      const names = [...form.querySelectorAll('[name]')].map(
        field => field.getAttribute('name')
      );
      expect(names.indexOf('estimatedAmount')).toBeLessThan(
        names.indexOf('summary')
      );
      expect(names.indexOf('isMemberPaidConsumable')).toBeLessThan(
        names.indexOf('summary')
      );
    });

    it('asks the single consumable question as required yes/no radios', () => {
      const radios = form.querySelectorAll<HTMLInputElement>(
        'input[type="radio"][name="isMemberPaidConsumable"]'
      );
      expect([...radios].map(radio => radio.value)).toStrictEqual([
        'true',
        'false',
      ]);
      expect(radios[0].required).toBe(true);
      expect(form.querySelector('[name="isOperations"]')).toBeNull();
      expect(form.querySelector('[name="under100PerYear"]')).toBeNull();
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
      expect(form.querySelector('[name="purchases[2][items]"]')).not.toBeNull();
      expect(form.querySelector('[name="purchases[2][link]"]')).not.toBeNull();
      expect(form.querySelector('[name="purchases[2][cost]"]')).not.toBeNull();
    });

    it('asks why it is needed', () => {
      expect(form.querySelector('textarea[name="justification"]')).not.toBeNull();
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
