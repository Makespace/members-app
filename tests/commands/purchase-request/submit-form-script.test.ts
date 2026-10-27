/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';
import {TypedPurchase} from '../../../src/purchasing/purchases';
import {
  classifyPurchase,
  earlyProposalReasons,
} from '../../../src/purchasing/classify-purchase';

// The cost breakdown page's inline script is a progressive enhancement; these
// run it in jsdom to check it manages the shops and items and keeps running
// totals.

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaIds: ['44444444-4444-4444-8444-444444444444' as UUID],
  areaNames: ['Wood Shop'],
  purchaserMemberNumbers: [],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

// Its whole budget already spent this year.
const spentUp = {
  ...woodShop,
  spentThisYearPence: 100_000,
  remainingPence: 0,
};

// The page 1 answers page 2's result goes on.
type Answers = {consumable: boolean; areas: ReadonlyArray<string>; risky: boolean};

const renderPage = (
  step: number,
  purchases: ReadonlyArray<TypedPurchase> = [],
  {consumable, areas, risky}: Answers = {consumable: false, areas: [], risky: false},
  purchasingArea = woodShop
) => {
  document.body.innerHTML = renderSubmitForm({
    requestId: '33333333-3333-4333-8333-333333333333' as UUID,
    budgetYear: 2026,
    purchasingAreas: [purchasingArea],
    proposalThresholdPence: 100_000,
    step,
    answers: {
      purchasingAreaId: purchasingArea.id,
      summary: 'Saw blades',
      justification: 'Blunt',
      purchases,
      isMemberPaidConsumable: String(consumable),
      affectsOtherAreas: String(areas.length > 0),
      affectedAreaIds: [],
      healthAndSafetyRisk: String(risky),
      buyingDirectly: '',
      amount: '',
      outsideBudget: '',
      proposal: {need: '', options: [], preferred: '', risks: [], location: '', owner: '', training: ''},
    },
    problems: [],
    chosen: O.some(purchasingArea),
    buyerRole: 'neither',
    affectedAreaNames: areas,
    areas: [
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
};

const setUp = (purchases: ReadonlyArray<TypedPurchase> = [], answers?: Answers) => {
  renderPage(2, purchases, answers);
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

    const done = (item: HTMLElement) =>
      item.querySelector<HTMLButtonElement>('[data-item-done]')!;

    it('stays open when focus moves away, until it is added', () => {
      const form = setUp();
      fillItem(form, 0, {sku: 'PEGF8418', quantity: '1', cost: '50'});
      form
        .querySelector<HTMLInputElement>('[name="purchases[0][items][0][sku]"]')!
        .focus();
      form.querySelector<HTMLInputElement>('[name="purchases[0][delivery]"]')!.focus();
      expect(folded(items(form)[0])).toBe(false);
    });

    it('folds an item when Add item is pressed, ready for the next', () => {
      const form = setUp();
      fillItem(form, 0, {sku: 'PEGF8418', quantity: '1', cost: '50'});
      expect(done(items(form)[0]).textContent).toBe('Add item');
      done(items(form)[0]).click();
      expect(folded(items(form)[0])).toBe(true);
      expect(summary(items(form)[0]).textContent).toContain(
        'PEGF8418 · Qty 1 · £50'
      );
      expect(document.activeElement?.hasAttribute('data-add-item')).toBe(true);
    });

    it('says what an unfinished item still needs when Add item is pressed', () => {
      const form = setUp();
      fillItem(form, 0, {sku: 'PEGF8418', quantity: '1'});
      done(items(form)[0]).click();
      expect(folded(items(form)[0])).toBe(false);
      expect(
        items(form)[0].querySelector('[data-item-message]')!.textContent
      ).toBe(
        'Give a link, SKU or notes, a whole-number quantity and a cost to add it.'
      );
    });

    it('calls it Done when editing an item already added', () => {
      const form = setUp([jewson]);
      summary(items(form)[0]).click();
      expect(done(items(form)[0]).textContent).toBe('Done');
      done(items(form)[0]).click();
      expect(folded(items(form)[0])).toBe(true);
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
    const answers = (consumable: boolean) => ({consumable, areas: [], risky: false});
    const costing = (form: HTMLFormElement, cost: string) => {
      fill(form, 'purchases[0][items][0][sku]', 'A');
      fill(form, 'purchases[0][items][0][quantity]', '1');
      fill(form, 'purchases[0][items][0][cost]', cost);
    };

    it('shows nothing until there is a total', () => {
      const form = setUp();
      expect(verdict(form).hidden).toBe(true);
      costing(form, '185');
      expect(verdict(form).hidden).toBe(false);
    });

    it('says which budget it comes out of, for the total so far', () => {
      const form = setUp();
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
      costing(form, '600');
      expect(verdict(form).querySelector('.purchase-verdict--proposal')).not.toBeNull();
      costing(form, '100');
      expect(verdict(form).querySelector('.purchase-verdict--budget')).not.toBeNull();
    });

    it('shows straight away when coming back to the page with answers', () => {
      document.body.innerHTML = '';
      const form = setUp([jewson]);
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
      const form = setUp([], answers(consumable));
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
    const costing = (form: HTMLFormElement, cost: string) => {
      fill(form, 'purchases[0][items][0][sku]', 'A');
      fill(form, 'purchases[0][items][0][quantity]', '1');
      fill(form, 'purchases[0][items][0][cost]', cost);
    };

    it('needs a proposal when other areas are affected', () => {
      const form = setUp([], {consumable: false, areas: ['Textiles'], risky: false});
      costing(form, '50');
      expect(verdict(form).querySelector('.purchase-verdict--proposal')).not.toBeNull();
      expect(verdict(form).textContent).toContain('It affects Textiles too');
    });

    it('shows a consumable needing a proposal for a safety risk', () => {
      const form = setUp([], {consumable: true, areas: [], risky: true});
      costing(form, '50');
      expect(verdict(form).textContent).toContain('Paid for by members · Proposal needed');
    });

    it.each([
      ['two other areas', false, '50', ['Metal Shop', 'Textiles'], false],
      ['a safety risk', false, '50', [], true],
      ['everything at once', false, '1200', ['Metal Shop'], true],
      ['a risky consumable', true, '50', [], true],
    ])('explains %s exactly as the server does', (_, consumable, cost, areas, risky) => {
      const form = setUp([], {consumable, areas, risky});
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

describe('the proposal notice under the budget on page 2', () => {
  const noticeUnderBudget = () =>
    document.querySelector('.purchase-budget + .purchase-verdict--proposal');

  it('is shown when the page 1 answers already mean a proposal', () => {
    renderPage(2, [], {consumable: false, areas: [], risky: true});
    expect(noticeUnderBudget()!.textContent).toContain(
      "You'll need to write a proposal"
    );
  });

  it('is not shown when it depends on the cost', () => {
    renderPage(2);
    expect(noticeUnderBudget()).toBeNull();
  });
});

describe('purchase request page 1 script', () => {
  const setUpPage1 = (purchasingArea = woodShop) => {
    renderPage(1, [], undefined, purchasingArea);
    return document.getElementById('purchase-about-form') as HTMLFormElement;
  };
  const pick = (form: HTMLFormElement, id: string) => {
    form.querySelector<HTMLInputElement>(`#${id}`)!.checked = true;
    form.dispatchEvent(new Event('change'));
  };
  const otherAreas = (form: HTMLFormElement) =>
    form.querySelector<HTMLElement>('[data-other-areas]')!;

  it('only lists the other areas once it says it affects some', () => {
    const form = setUpPage1();
    expect(otherAreas(form).hidden).toBe(true);
    pick(form, 'affects-yes');
    expect(otherAreas(form).hidden).toBe(false);
    pick(form, 'affects-no');
    expect(otherAreas(form).hidden).toBe(true);
  });

  describe('the proposal notice', () => {
    const reasons = (form: HTMLFormElement) =>
      [
        ...form.querySelectorAll('[data-early-proposal] [data-early-proposal-reasons] p'),
      ].map(paragraph => paragraph.textContent);
    const tick = (form: HTMLFormElement, areaId: string) => {
      form.querySelector<HTMLInputElement>(
        `input[name="affectedAreaIds"][value="${areaId}"]`
      )!.checked = true;
      form.dispatchEvent(new Event('change'));
    };

    it('is not shown while nothing yet means a proposal', () => {
      expect(reasons(setUpPage1())).toStrictEqual([]);
    });

    it('appears as soon as it says it presents a safety risk, and goes when it says not', () => {
      const form = setUpPage1();
      pick(form, 'risk-yes');
      expect(reasons(form)).toStrictEqual(
        earlyProposalReasons({
          isMemberPaidConsumable: false,
          affectedAreaNames: [],
          healthAndSafetyRisk: true,
          yearlyBudgetPence: woodShop.yearlyBudgetPence,
          spentThisYearPence: woodShop.spentThisYearPence,
        })
      );
      pick(form, 'risk-no');
      expect(reasons(form)).toStrictEqual([]);
    });

    it('names the other areas it affects exactly as the server does', () => {
      const form = setUpPage1();
      pick(form, 'affects-yes');
      tick(form, '66666666-6666-4666-8666-666666666666');
      tick(form, '77777777-7777-4777-8777-777777777777');
      expect(reasons(form)).toStrictEqual(
        earlyProposalReasons({
          isMemberPaidConsumable: false,
          affectedAreaNames: ['Metal Shop', 'Textiles'],
          healthAndSafetyRisk: false,
          yearlyBudgetPence: woodShop.yearlyBudgetPence,
          spentThisYearPence: woodShop.spentThisYearPence,
        })
      );
    });

    describe('when the yearly budget is already used up', () => {
      it('says so exactly as the server does', () => {
        const form = setUpPage1(spentUp);
        expect(reasons(form)).toStrictEqual(
          earlyProposalReasons({
            isMemberPaidConsumable: false,
            affectedAreaNames: [],
            healthAndSafetyRisk: false,
            yearlyBudgetPence: spentUp.yearlyBudgetPence,
            spentThisYearPence: spentUp.spentThisYearPence,
          })
        );
        expect(reasons(form)).toHaveLength(1);
      });

      it('is not shown for a consumable members pay for', () => {
        const form = setUpPage1(spentUp);
        pick(form, 'consumable-yes');
        expect(reasons(form)).toStrictEqual([]);
      });
    });
  });
});
