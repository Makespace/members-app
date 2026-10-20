/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';
import {TypedPurchase} from '../../../src/purchasing/purchases';
import {classifyPurchase} from '../../../src/purchasing/classify-purchase';

// The cost breakdown page's inline script is a progressive enhancement; these
// run it in jsdom to check it manages the shops and items and keeps running
// totals.

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaIds: ['44444444-4444-4444-8444-444444444444' as UUID],
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
      affectsOtherAreas: 'false',
      affectedAreaIds: [],
      healthAndSafetyRisk: 'false',
      proposal: {need: '', options: [], preferred: '', risks: [], location: '', owner: '', training: ''},
    },
    problems: [],
    chosen: O.some(woodShop),
    otherAreas: [
      {id: '66666666-6666-4666-8666-666666666666' as UUID, name: 'Metal Shop'},
      {id: '77777777-7777-4777-8777-777777777777' as UUID, name: 'Textiles'},
    ],
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
    {url: '', sku: 'PEGF8418', quantity: '1', cost: '50', notes: ''},
    {url: '', sku: 'PBJT4750', quantity: '4', cost: '100', notes: '4.8m'},
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
      [
        ...added.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input, textarea'
        ),
      ].map(field => field.value)
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

  it('adds up each shop, with delivery, and the whole request', () => {
    const form = setUp();
    fill(form, 'purchases[0][items][0][quantity]', '4');
    fill(form, 'purchases[0][items][0][cost]', '50');
    fill(form, 'purchases[0][delivery]', '7');
    expect(
      shops(form)[0].querySelector('[data-shop-total]')!.textContent
    ).toContain('Shop total: £57');
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    fill(form, 'purchases[2][items][0][quantity]', '1');
    fill(form, 'purchases[2][items][0][cost]', '3.50');
    expect(totalText(form)).toContain('Total: £60.50');
  });

  describe('folding finished items', () => {
    const items = (form: HTMLFormElement) =>
      [...shops(form)[0].querySelectorAll<HTMLElement>('[data-item-entry]')];
    const folded = (item: HTMLElement) =>
      item.querySelector<HTMLElement>('[data-item-body]')!.hidden;
    const summary = (item: HTMLElement) =>
      item.querySelector<HTMLButtonElement>('[data-item-summary]')!;
    const fillItem = (
      form: HTMLFormElement,
      index: number,
      fields: Record<string, string>
    ) =>
      Object.entries(fields).forEach(([field, value]) =>
        fill(form, `purchases[0][items][${index}][${field}]`, value)
      );

    it('starts with finished items folded when coming back to the page', () => {
      const form = setUp([jewson]);
      expect(items(form).map(folded)).toStrictEqual([true, true]);
      expect(summary(items(form)[1]).textContent).toBe(
        'PBJT4750 · Qty 4 · £100 · 4.8mEdit'
      );
    });

    it('leaves a blank item open', () => {
      const form = setUp();
      expect(folded(items(form)[0])).toBe(false);
    });

    it('folds an item once it is finished and focus moves on', () => {
      const form = setUp();
      fillItem(form, 0, {sku: 'PEGF8418', quantity: '1', cost: '50'});
      form
        .querySelector<HTMLInputElement>('[name="purchases[0][items][0][sku]"]')!
        .focus();
      form.querySelector<HTMLInputElement>('[name="purchases[0][shop]"]')!.focus();
      expect(folded(items(form)[0])).toBe(true);
      expect(summary(items(form)[0]).textContent).toContain(
        'PEGF8418 · Qty 1 · £50'
      );
    });

    it('stays open while focus moves within the item', () => {
      const form = setUp();
      fillItem(form, 0, {sku: 'PEGF8418', quantity: '1', cost: '50'});
      form
        .querySelector<HTMLInputElement>('[name="purchases[0][items][0][sku]"]')!
        .focus();
      form
        .querySelector<HTMLInputElement>('[name="purchases[0][items][0][cost]"]')!
        .focus();
      expect(folded(items(form)[0])).toBe(false);
    });

    it('keeps an unfinished item open so nothing wrong is hidden', () => {
      const form = setUp();
      fillItem(form, 0, {sku: 'PEGF8418', quantity: '1'});
      form
        .querySelector<HTMLInputElement>('[name="purchases[0][items][0][sku]"]')!
        .focus();
      form.querySelector<HTMLInputElement>('[name="purchases[0][shop]"]')!.focus();
      expect(folded(items(form)[0])).toBe(false);
    });

    it('opens a folded item to edit when its summary is clicked', () => {
      const form = setUp([jewson]);
      summary(items(form)[0]).click();
      expect(folded(items(form)[0])).toBe(false);
      expect(document.activeElement?.getAttribute('name')).toBe(
        'purchases[0][items][0][url]'
      );
    });

    it('opens a folded item when tabbed onto', () => {
      const form = setUp([jewson]);
      summary(items(form)[1]).focus();
      expect(folded(items(form)[1])).toBe(false);
    });

    it('opens a folded item holding a field the browser says is missing', () => {
      const form = setUp([jewson]);
      const sku = form.querySelector<HTMLInputElement>(
        '[name="purchases[0][items][0][sku]"]'
      )!;
      sku.required = true;
      sku.value = '';
      sku.dispatchEvent(new Event('invalid'));
      expect(folded(items(form)[0])).toBe(false);
    });
  });

  describe('the budget result', () => {
    const verdict = (form: HTMLFormElement) =>
      form.querySelector<HTMLElement>('[data-budget-verdict]')!;
    const answer = (form: HTMLFormElement, consumable: boolean) => {
      form.querySelector<HTMLInputElement>(
        consumable ? '#consumable-yes' : '#consumable-no'
      )!.checked = true;
      form.dispatchEvent(new Event('change'));
    };
    const costing = (form: HTMLFormElement, cost: string) => {
      fill(form, 'purchases[0][items][0][sku]', 'A');
      fill(form, 'purchases[0][items][0][quantity]', '1');
      fill(form, 'purchases[0][items][0][cost]', cost);
    };

    it('shows nothing until there is a total and the question is answered', () => {
      const form = setUp();
      costing(form, '185');
      expect(verdict(form).hidden).toBe(true);
      answer(form, false);
      expect(verdict(form).hidden).toBe(false);
    });

    it('says which budget it comes out of, for the total so far', () => {
      const form = setUp();
      answer(form, false);
      costing(form, '185');
      expect(verdict(form).textContent.replace(/\s+/g, ' ')).toContain(
        'For the £185 total'
      );
      expect(verdict(form).textContent).toContain(
        'This comes out of your yearly budget. No proposal needed.'
      );
    });

    it('updates as costs change, saying when a proposal is needed', () => {
      const form = setUp();
      answer(form, false);
      costing(form, '600');
      expect(verdict(form).querySelector('.purchase-verdict--proposal')).not.toBeNull();
      costing(form, '100');
      expect(verdict(form).querySelector('.purchase-verdict--budget')).not.toBeNull();
    });

    it('shows straight away when coming back to the page with answers', () => {
      document.body.innerHTML = '';
      const form = setUp([jewson]);
      answer(form, false);
      expect(verdict(form).textContent.replace(/\s+/g, ' ')).toContain(
        'For the £150 total'
      );
    });

    it.each([
      ['a consumable', true, '50'],
      ['within budget', false, '185'],
      ['landing exactly on the budget', false, '580'],
      ['over the budget', false, '580.01'],
      ['a single purchase of £1,000', false, '1000'],
    ])('explains %s exactly as the server does', (_, consumable, cost) => {
      const form = setUp();
      answer(form, consumable);
      costing(form, cost);
      expect(
        verdict(form).querySelector('[data-verdict-reason]')!.textContent
      ).toBe(
        classifyPurchase({
        affectedAreaNames: [],
        healthAndSafetyRisk: false,
          isMemberPaidConsumable: consumable,
          amountPence: Math.round(Number(cost) * 100),
          yearlyBudgetPence: woodShop.yearlyBudgetPence,
          spentThisYearPence: woodShop.spentThisYearPence,
        }).reason
      );
    });
  });

  describe('folding shops', () => {
    const shopFolded = (shop: HTMLElement) =>
      shop.querySelector<HTMLElement>('[data-shop-fields]')!.hidden;
    const shopSummary = (shop: HTMLElement) =>
      shop.querySelector<HTMLButtonElement>('[data-shop-summary]')!;
    const visibleItems = (shop: HTMLElement) =>
      [...shop.querySelectorAll<HTMLElement>('[data-item-entry]')].filter(
        item => !item.hidden
      );
    const withDelivery: TypedPurchase = {...jewson, delivery: '12'};

    it('starts with named shops folded, their items still listed', () => {
      const form = setUp([withDelivery]);
      const shop = shops(form)[0];
      expect(shopFolded(shop)).toBe(true);
      expect(shopSummary(shop).textContent).toBe(
        'jewson.co.uk · 2 items · £162 · including £12 deliveryEdit'
      );
      expect(visibleItems(shop)).toHaveLength(2);
      expect(
        shop.querySelector<HTMLElement>('[data-add-item]')!.hidden
      ).toBe(true);
    });

    it('leaves a shop with no name open', () => {
      const form = setUp();
      expect(shopFolded(shops(form)[0])).toBe(false);
    });

    it('folds a shop when another shop is worked on', () => {
      const form = setUp([jewson]);
      form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
      const [first, second] = shops(form);
      expect(shopFolded(first)).toBe(true);
      expect(visibleItems(first)).toHaveLength(2);
      expect(shopFolded(second)).toBe(false);
    });

    it('opens a folded shop when its summary is clicked, folding the others', () => {
      const form = setUp([jewson]);
      form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
      fill(form, 'purchases[2][shop]', 'screwfix.com');
      const [first, second] = shops(form);
      shopSummary(first).click();
      expect(shopFolded(first)).toBe(false);
      expect(shopFolded(second)).toBe(true);
      expect(document.activeElement?.getAttribute('name')).toBe(
        'purchases[0][shop]'
      );
    });

    it('opens a folded shop when one of its items is opened', () => {
      const form = setUp([jewson]);
      const shop = shops(form)[0];
      shop.querySelector<HTMLButtonElement>('[data-item-summary]')!.click();
      expect(shopFolded(shop)).toBe(false);
    });
  });

  describe('other areas and health and safety', () => {
    const verdict = (form: HTMLFormElement) =>
      form.querySelector<HTMLElement>('[data-budget-verdict]')!;
    const pick = (form: HTMLFormElement, id: string) => {
      form.querySelector<HTMLInputElement>(`#${id}`)!.checked = true;
      form.dispatchEvent(new Event('change'));
    };
    const tick = (form: HTMLFormElement, name: string) => {
      [
        ...form.querySelectorAll<HTMLInputElement>('input[name="affectedAreaIds"]'),
      ]
        .find(box => box.closest('label')!.textContent.trim() === name)!
        .checked = true;
      form.dispatchEvent(new Event('change'));
    };
    const costing = (form: HTMLFormElement, cost: string) => {
      fill(form, 'purchases[0][items][0][sku]', 'A');
      fill(form, 'purchases[0][items][0][quantity]', '1');
      fill(form, 'purchases[0][items][0][cost]', cost);
    };
    const otherAreas = (form: HTMLFormElement) =>
      form.querySelector<HTMLElement>('[data-other-areas]')!;

    it('only lists the other areas once it says it affects some', () => {
      const form = setUp();
      expect(otherAreas(form).hidden).toBe(true);
      pick(form, 'affects-yes');
      expect(otherAreas(form).hidden).toBe(false);
      pick(form, 'affects-no');
      expect(otherAreas(form).hidden).toBe(true);
    });

    it('needs a proposal once other areas are affected', () => {
      const form = setUp();
      pick(form, 'consumable-no');
      costing(form, '50');
      expect(verdict(form).querySelector('.purchase-verdict--budget')).not.toBeNull();
      pick(form, 'affects-yes');
      tick(form, 'Textiles');
      expect(verdict(form).querySelector('.purchase-verdict--proposal')).not.toBeNull();
      expect(verdict(form).textContent).toContain('It affects Textiles too');
    });

    it('shows a consumable needing a proposal for a safety risk', () => {
      const form = setUp();
      pick(form, 'consumable-yes');
      pick(form, 'risk-yes');
      costing(form, '50');
      expect(verdict(form).textContent).toContain('Consumable · Proposal needed');
    });

    it.each([
      ['two other areas', false, '50', ['Metal Shop', 'Textiles'], false],
      ['a safety risk', false, '50', [], true],
      ['everything at once', false, '1200', ['Metal Shop'], true],
      ['a risky consumable', true, '50', [], true],
    ])('explains %s exactly as the server does', (_, consumable, cost, areas, risky) => {
      const form = setUp();
      pick(form, consumable ? 'consumable-yes' : 'consumable-no');
      if (areas.length) {
        pick(form, 'affects-yes');
        areas.forEach(area => tick(form, area));
      }
      if (risky) pick(form, 'risk-yes');
      costing(form, cost);
      expect(
        verdict(form).querySelector('[data-verdict-reason]')!.textContent
      ).toBe(
        classifyPurchase({
          affectedAreaNames: areas,
          healthAndSafetyRisk: risky,
          isMemberPaidConsumable: consumable,
          amountPence: Math.round(Number(cost) * 100),
          yearlyBudgetPence: woodShop.yearlyBudgetPence,
          spentThisYearPence: woodShop.spentThisYearPence,
        }).reason
      );
    });
  });
});
