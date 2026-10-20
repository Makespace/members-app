/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';
import {RawPurchase} from '../../../src/purchasing/purchases';

// The cost breakdown page's inline script is a progressive enhancement; these
// run it in jsdom to check it manages the shop entries and keeps a running
// total.

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaNames: ['Wood Shop'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

const setUp = (purchases: ReadonlyArray<RawPurchase> = []) => {
  document.body.innerHTML = renderSubmitForm({
    requestId: '33333333-3333-4333-8333-333333333333' as UUID,
    budgetYear: 2026,
    purchasingAreas: [woodShop],
    proposalThresholdPence: 100_000,
    step: 2,
    answers: {
      purchasingAreaId: woodShop.id,
      summary: 'Saw blades',
      justification: 'Blunt',
      purchases,
      isMemberPaidConsumable: '',
    },
    problems: [],
    chosen: O.some(woodShop),
    result: O.none,
  });
  // Scripts set through innerHTML don't run; a freshly added one does.
  const inline = document.querySelector('script')!;
  const script = document.createElement('script');
  script.textContent = inline.textContent;
  inline.replaceWith(script);
  return document.getElementById('purchase-costs-form') as HTMLFormElement;
};

const typeCost = (form: HTMLFormElement, index: number, value: string) => {
  form.querySelector<HTMLInputElement>(
    `[name="purchases[${index}][cost]"]`
  )!.value = value;
  form.dispatchEvent(new Event('input'));
};

const totalText = (form: HTMLFormElement) =>
  form.querySelector('[data-shop-total]')!.textContent.replace(/\s+/g, ' ');

describe('purchase request cost breakdown script', () => {
  it('starts with one blank shop', () => {
    const form = setUp();
    expect(form.querySelectorAll('[data-shop-entry]')).toHaveLength(1);
    expect(totalText(form)).toBe('');
  });

  it('keeps the shops already filled in when coming back to the page', () => {
    const form = setUp([
      {shop: 'Axminster', items: 'blade', cost: '150'},
      {shop: 'Toolstation', items: 'guard', cost: '100'},
    ]);
    expect(form.querySelectorAll('[data-shop-entry]')).toHaveLength(2);
    expect(totalText(form)).toContain('Total: £250');
  });

  it('adds and removes shops, keeping field names unique', () => {
    const form = setUp();
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

  it('starts an added shop blank, even when copied from a filled one', () => {
    const form = setUp([{shop: 'Axminster', items: 'blade', cost: '150'}]);
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    const added = form.querySelectorAll('[data-shop-entry]')[1];
    expect(
      [...added.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map(
        field => field.value
      )
    ).toStrictEqual(['', '', '', '']);
  });

  it('keeps a running total of the shop costs', () => {
    const form = setUp();
    typeCost(form, 0, '400');
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    typeCost(form, 3, '200.50');
    expect(totalText(form)).toContain('Total: £600.50');
  });
});
