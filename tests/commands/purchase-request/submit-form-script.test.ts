/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';
import {classifyPurchase} from '../../../src/purchasing/classify-purchase';

// The cost breakdown page's inline script is a progressive enhancement; these
// run it in jsdom to check it manages the shop entries and says what their
// costs add up to.

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaNames: ['Wood Shop'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

const setUp = (consumable = false, estimatePence = 25_000) => {
  document.body.innerHTML = renderSubmitForm({
    requestId: '33333333-3333-4333-8333-333333333333' as UUID,
    budgetYear: 2026,
    purchasingAreas: [woodShop],
    proposalThresholdPence: 100_000,
    step: 3,
    answers: {
      purchasingAreaId: woodShop.id,
      summary: 'Saw blades',
      justification: 'Blunt',
      estimatedAmount: String(estimatePence / 100),
      isMemberPaidConsumable: String(consumable),
    },
    missing: [],
    chosen: O.some(woodShop),
    estimate: O.some({
      amountPence: estimatePence,
      classification: classifyPurchase({
        isMemberPaidConsumable: consumable,
        amountPence: estimatePence,
        yearlyBudgetPence: woodShop.yearlyBudgetPence,
        spentThisYearPence: woodShop.spentThisYearPence,
      }),
    }),
  });
  // Scripts set through innerHTML don't run; a freshly added one does.
  const inline = document.querySelector('script')!;
  const script = document.createElement('script');
  script.textContent = inline.textContent;
  inline.replaceWith(script);
  return document.getElementById('purchase-request-form') as HTMLFormElement;
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
  it('starts with one shop', () => {
    const form = setUp();
    expect(form.querySelectorAll('[data-shop-entry]')).toHaveLength(1);
    expect(totalText(form)).toBe('');
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

  it('says when the costs match the estimate', () => {
    const form = setUp();
    typeCost(form, 0, '250');
    expect(totalText(form)).toContain(
      'These add up to £250, the same as your estimate.'
    );
    expect(totalText(form)).toContain('no proposal needed');
  });

  it('points out costs that differ from the estimate, and goes by the costs', () => {
    const form = setUp();
    typeCost(form, 0, '400');
    form.querySelector<HTMLButtonElement>('[data-add-shop]')!.click();
    typeCost(form, 3, '200');
    expect(totalText(form)).toContain(
      'These add up to £600, more than your £250 estimate. The shop total is what counts.'
    );
    expect(totalText(form)).toContain(
      'At this total you will need to write a proposal.'
    );
  });

  it('needs a proposal at £1,000 even with budget to spare', () => {
    const form = setUp(false, 10_000);
    typeCost(form, 0, '1000');
    expect(totalText(form)).toContain('will need to write a proposal');
  });

  it("doesn't talk about proposals for a consumable", () => {
    const form = setUp(true);
    typeCost(form, 0, '2000');
    expect(totalText(form)).not.toContain('proposal');
  });
});
