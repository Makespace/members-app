/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderSubmitForm} from '../../../src/commands/purchase-request/render-submit-form';
import {classifyPurchase} from '../../../src/purchasing/classify-purchase';

// The check and send page's inline script adds and removes proposal options
// and risks; these run it in jsdom.

const woodShop = {
  id: '11111111-1111-4111-8111-111111111111' as UUID,
  name: 'Wood Shop',
  areaIds: ['44444444-4444-4444-8444-444444444444' as UUID],
  areaNames: ['Wood Shop'],
  yearlyBudgetPence: 100_000,
  spentThisYearPence: 42_000,
  remainingPence: 58_000,
};

const setUp = () => {
  document.body.innerHTML = renderSubmitForm({
    requestId: '33333333-3333-4333-8333-333333333333' as UUID,
    budgetYear: 2026,
    purchasingAreas: [woodShop],
    proposalThresholdPence: 100_000,
    step: 3,
    answers: {
      purchasingAreaId: woodShop.id,
      summary: 'New planer',
      justification: 'The old one is unsafe',
      purchases: [],
      isMemberPaidConsumable: 'false',
      affectsOtherAreas: 'false',
      affectedAreaIds: [],
      healthAndSafetyRisk: 'true',
      proposal: {
        need: '',
        options: [],
        preferred: '',
        risks: [],
        location: '',
        owner: '',
        training: '',
      },
    },
    problems: [],
    chosen: O.some(woodShop),
    otherAreas: [],
    result: O.some({
      purchases: [],
      totalPence: 50_000,
      affectedAreaNames: [],
      classification: classifyPurchase({
        affectedAreaNames: [],
        healthAndSafetyRisk: true,
        isMemberPaidConsumable: false,
        amountPence: 50_000,
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
  return document.getElementById('purchase-check-form') as HTMLFormElement;
};

const names = (form: HTMLFormElement, list: string, field: string) =>
  [
    ...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      `[data-repeat="${list}"] [name$="[${field}]"]`
    ),
  ].map(input => input.name);

describe('proposal options and risks script', () => {
  it('starts with one blank option and one blank risk', () => {
    const form = setUp();
    expect(names(form, 'options', 'description')).toStrictEqual([
      'proposal[options][0][description]',
    ]);
    expect(names(form, 'risks', 'hazard')).toStrictEqual([
      'proposal[risks][0][hazard]',
    ]);
  });

  it('adds and removes options, keeping names unique', () => {
    const form = setUp();
    const add = form.querySelector<HTMLButtonElement>('[data-repeat-add="options"]')!;
    add.click();
    add.click();
    expect(names(form, 'options', 'cost')).toStrictEqual([
      'proposal[options][0][cost]',
      'proposal[options][3][cost]',
      'proposal[options][4][cost]',
    ]);
    expect(
      form.querySelectorAll('[data-repeat="options"] [data-repeat-title]')[2]
        .textContent
    ).toBe('Option 3');
    form
      .querySelectorAll<HTMLButtonElement>('[data-repeat="options"] [data-repeat-remove]')[1]
      .click();
    expect(names(form, 'options', 'cost')).toStrictEqual([
      'proposal[options][0][cost]',
      'proposal[options][4][cost]',
    ]);
  });

  it('adds risks separately from options', () => {
    const form = setUp();
    form.querySelector<HTMLButtonElement>('[data-repeat-add="risks"]')!.click();
    expect(names(form, 'risks', 'actions')).toStrictEqual([
      'proposal[risks][0][actions]',
      'proposal[risks][3][actions]',
    ]);
    expect(names(form, 'options', 'description')).toHaveLength(1);
  });

  it('starts an added risk with its ratings unchosen', () => {
    const form = setUp();
    form.querySelector<HTMLSelectElement>(
      'select[name="proposal[risks][0][severity]"]'
    )!.value = '4';
    form.querySelector<HTMLButtonElement>('[data-repeat-add="risks"]')!.click();
    const added = [
      ...form.querySelectorAll<HTMLSelectElement>(
        '[data-repeat="risks"] [data-repeat-entry]:last-child select'
      ),
    ];
    expect(added.map(select => select.name)).toStrictEqual([
      'proposal[risks][3][severity]',
      'proposal[risks][3][probability]',
      'proposal[risks][3][residualSeverity]',
      'proposal[risks][3][residualProbability]',
    ]);
    expect(added.map(select => select.value)).toStrictEqual(['', '', '', '']);
  });
});
