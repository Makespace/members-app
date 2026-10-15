/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';

// The form's inline script is a progressive enhancement; these run it in
// jsdom to check it reveals sections and gives the same verdicts as the
// server would.

const woodShopId = '11111111-1111-4111-8111-111111111111' as UUID;
const craftId = '22222222-2222-4222-8222-222222222222' as UUID;

const setUp = () => {
  document.body.innerHTML = renderSubmitForm({
    requestId: '33333333-3333-4333-8333-333333333333' as UUID,
    budgetYear: 2026,
    purchasingAreas: [
      {
        id: woodShopId,
        name: 'Wood Shop',
        areaNames: ['Wood Shop'],
        yearlyBudgetPence: 100_000,
        spentThisYearPence: 42_000,
        remainingPence: 58_000,
      },
      {
        id: craftId,
        name: 'Craft & Art',
        areaNames: ['Craft Room', 'Art Space'],
        yearlyBudgetPence: 100_000,
        spentThisYearPence: 88_000,
        remainingPence: 12_000,
      },
    ],
    preselected: O.none,
    proposalThresholdPence: 100_000,
  });
  // Scripts set through innerHTML don't run; a freshly added one does.
  const inline = document.querySelector('script')!;
  const script = document.createElement('script');
  script.textContent = inline.textContent;
  inline.replaceWith(script);
  return document.getElementById('purchase-request-form') as HTMLFormElement;
};

const choose = (form: HTMLFormElement, id: string) => {
  const radio = document.getElementById(id) as HTMLInputElement;
  radio.checked = true;
  form.dispatchEvent(new Event('change'));
};

const typeAmount = (form: HTMLFormElement, value: string) => {
  form.querySelector<HTMLInputElement>('#estimatedAmount')!.value = value;
  form.dispatchEvent(new Event('input'));
};

const verdict = (form: HTMLFormElement) =>
  form.querySelector<HTMLElement>('[data-verdict]')!;

const visible = (element: Element) => !(element as HTMLElement).hidden;

describe('purchase request form script', () => {
  it('starts with nothing chosen: no budget, no verdict, no specifics, one shop', () => {
    const form = setUp();
    expect(
      [...form.querySelectorAll('[data-budget-for]')].filter(visible)
    ).toHaveLength(0);
    expect(verdict(form).hidden).toBe(true);
    expect(
      form.querySelector<HTMLElement>('[data-submit-section]')!.hidden
    ).toBe(true);
    expect(form.querySelectorAll('[data-shop-entry]')).toHaveLength(1);
  });

  it("shows only the chosen area's budget", () => {
    const form = setUp();
    choose(form, `area-${craftId}`);
    const shown = [...form.querySelectorAll<HTMLElement>('[data-budget-for]')]
      .filter(visible)
      .map(panel => panel.dataset.budgetFor);
    expect(shown).toStrictEqual([craftId]);
  });

  it('says a consumable does not come out of the budget', () => {
    const form = setUp();
    choose(form, `area-${woodShopId}`);
    typeAmount(form, '185');
    choose(form, 'consumable-yes');
    expect(verdict(form).hidden).toBe(false);
    expect(verdict(form).textContent).toContain(
      "This doesn't come out of your yearly budget"
    );
    expect(
      verdict(form).querySelector('.purchase-verdict--consumable')
    ).not.toBeNull();
    expect(
      form.querySelector<HTMLElement>('[data-submit-section]')!.hidden
    ).toBe(false);
  });

  it('says what a budget purchase leaves, without changing the budget bar', () => {
    const form = setUp();
    choose(form, `area-${woodShopId}`);
    typeAmount(form, '185');
    choose(form, 'consumable-no');
    expect(verdict(form).textContent).toContain('No proposal needed');
    expect(verdict(form).textContent).toContain('leaving £395');
    const bar = form.querySelector<HTMLElement>(
      `[data-budget-for="${woodShopId}"] [data-budget-bar]`
    )!;
    expect(bar.querySelector('.purchase-bar__new')).toBeNull();
    expect(bar.textContent).not.toContain('This purchase');
    expect(
      bar.querySelector<HTMLElement>('.purchase-bar__spent')!.style.width
    ).toBe('42%');
  });

  it('needs a proposal for going over the budget', () => {
    const form = setUp();
    choose(form, `area-${craftId}`);
    typeAmount(form, '120.01');
    choose(form, 'consumable-no');
    expect(
      verdict(form).querySelector('.purchase-verdict--proposal')
    ).not.toBeNull();
    expect(verdict(form).textContent).toContain('over its £1,000 budget');
  });

  it('needs no proposal when landing exactly on the budget', () => {
    const form = setUp();
    choose(form, `area-${craftId}`);
    typeAmount(form, '120');
    choose(form, 'consumable-no');
    expect(verdict(form).textContent).toContain('No proposal needed');
  });

  it('needs a proposal for a single purchase of £1,000', () => {
    const form = setUp();
    choose(form, `area-${woodShopId}`);
    typeAmount(form, '1000');
    choose(form, 'consumable-no');
    expect(verdict(form).textContent).toContain(
      'Any single purchase of £1,000 or more needs a proposal'
    );
  });

  it('adds and removes shops, keeping field names unique', () => {
    const form = setUp();
    choose(form, `area-${woodShopId}`);
    choose(form, 'consumable-no');
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    const names = () =>
      [...form.querySelectorAll<HTMLInputElement>('input[name$="[shop]"]')].map(
        input => input.name
      );
    expect(names()).toStrictEqual([
      'purchases[0][shop]',
      'purchases[3][shop]',
      'purchases[4][shop]',
    ]);
    form
      .querySelectorAll<HTMLButtonElement>('[data-remove-shop]')[1]
      .click();
    expect(names()).toStrictEqual(['purchases[0][shop]', 'purchases[4][shop]']);
  });

  it('flags shop costs that do not add up to the estimate', () => {
    const form = setUp();
    choose(form, `area-${woodShopId}`);
    typeAmount(form, '185');
    choose(form, 'consumable-no');
    form.querySelector<HTMLInputElement>('[name="purchases[0][cost]"]')!.value =
      '150';
    form.dispatchEvent(new Event('input'));
    expect(form.querySelector('[data-shop-total]')!.textContent).toContain(
      'These add up to £150, but your estimate above is £185'
    );
  });
});
