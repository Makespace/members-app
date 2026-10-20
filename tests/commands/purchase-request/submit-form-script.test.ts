/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';
import {TypedPurchase} from '../../../src/purchasing/purchases';

// The cost breakdown page's inline script is a progressive enhancement; these
// run it in jsdom to check it manages the shops and items and keeps running
// totals.

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaNames: ['Wood Shop'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

const setUp = (purchases: ReadonlyArray<TypedPurchase> = []) => {
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

const fill = (form: HTMLFormElement, name: string, value: string) => {
  form.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value;
  form.dispatchEvent(new Event('input'));
};

const shops = (form: HTMLFormElement) =>
  [...form.querySelectorAll<HTMLElement>('[data-shop-entry]')];

const itemNames = (shop: HTMLElement, field: string) =>
  [
    ...shop.querySelectorAll<HTMLInputElement>(`input[name$="[${field}]"]`),
  ].map(input => input.name);

const totalText = (form: HTMLFormElement) =>
  form.querySelector('[data-request-total]')!.textContent.replace(/\s+/g, ' ');

const jewson: TypedPurchase = {
  shop: 'jewson.co.uk',
  delivery: '',
  items: [
    {url: '', sku: 'PEGF8418', quantity: '1', price: '50', notes: ''},
    {url: '', sku: 'PBJT4750', quantity: '4', price: '25', notes: '4.8m'},
  ],
};

describe('purchase request cost breakdown script', () => {
  it('starts with one blank shop holding one blank item', () => {
    const form = setUp();
    expect(shops(form)).toHaveLength(1);
    expect(shops(form)[0].querySelectorAll('[data-item-entry]')).toHaveLength(1);
    expect(totalText(form)).toBe('');
  });

  it('keeps the shops and items already filled in when coming back', () => {
    const form = setUp([jewson]);
    expect(shops(form)).toHaveLength(1);
    expect(shops(form)[0].querySelectorAll('[data-item-entry]')).toHaveLength(2);
    expect(totalText(form)).toContain('Total: £150');
  });

  it('adds and removes items within a shop, keeping names unique', () => {
    const form = setUp();
    const shop = shops(form)[0];
    shop.querySelector<HTMLButtonElement>('[data-add-item]')!.click();
    shop.querySelector<HTMLButtonElement>('[data-add-item]')!.click();
    expect(itemNames(shop, 'sku')).toStrictEqual([
      'purchases[0][items][0][sku]',
      'purchases[0][items][3][sku]',
      'purchases[0][items][4][sku]',
    ]);
    shop.querySelectorAll<HTMLButtonElement>('[data-remove-item]')[1].click();
    expect(itemNames(shop, 'sku')).toStrictEqual([
      'purchases[0][items][0][sku]',
      'purchases[0][items][4][sku]',
    ]);
  });

  it('adds a blank shop with one blank item, numbered after the others', () => {
    const form = setUp([jewson]);
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    const added = shops(form)[1];
    expect(itemNames(added, 'sku')).toStrictEqual(['purchases[2][items][0][sku]']);
    expect(
      [...added.querySelectorAll<HTMLInputElement>('input')].map(
        field => field.value
      )
    ).toStrictEqual(['', '', '', '', '', '', '']);
    added.querySelector<HTMLButtonElement>('[data-add-item]')!.click();
    expect(itemNames(added, 'sku')).toStrictEqual([
      'purchases[2][items][0][sku]',
      'purchases[2][items][1][sku]',
    ]);
  });

  it('removes a shop', () => {
    const form = setUp([jewson]);
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    shops(form)[1].querySelector<HTMLButtonElement>('[data-remove-shop]')!.click();
    expect(shops(form)).toHaveLength(1);
  });

  it('totals each shop, with delivery, and the whole request', () => {
    const form = setUp();
    fill(form, 'purchases[0][items][0][quantity]', '4');
    fill(form, 'purchases[0][items][0][price]', '12.50');
    fill(form, 'purchases[0][delivery]', '7');
    expect(
      shops(form)[0].querySelector('[data-shop-total]')!.textContent
    ).toContain('Shop total: £57');
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    fill(form, 'purchases[2][items][0][quantity]', '1');
    fill(form, 'purchases[2][items][0][price]', '3.50');
    expect(totalText(form)).toContain('Total: £60.50');
  });
});
