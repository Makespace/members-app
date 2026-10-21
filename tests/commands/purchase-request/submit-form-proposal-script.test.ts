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

type Prefill = {
  options?: ReadonlyArray<{description: string; pros: string; cons: string; cost: string}>;
  risks?: ReadonlyArray<{
    hazard: string;
    harm: string;
    severity: string;
    probability: string;
    actions: string;
    residualSeverity: string;
    residualProbability: string;
  }>;
};

const setUp = (prefill: Prefill = {}) => {
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
        options: prefill.options ?? [],
        preferred: '',
        risks: prefill.risks ?? [],
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

  describe('folding', () => {
    const option = {description: 'Build our own', pros: 'Fits', cons: 'Slow', cost: '1022.20'};
    const risk = {
      hazard: 'Tipping over',
      harm: 'People nearby',
      severity: '4',
      probability: '3',
      actions: 'Fix to the wall',
      residualSeverity: '4',
      residualProbability: '1',
    };
    const entries = (form: HTMLFormElement, list: string) => [
      ...form.querySelectorAll<HTMLElement>(
        `[data-repeat="${list}"] [data-repeat-entry]`
      ),
    ];
    const folded = (entry: HTMLElement) =>
      entry.querySelector<HTMLElement>('[data-repeat-body]')!.hidden;
    const summary = (entry: HTMLElement) =>
      entry.querySelector<HTMLButtonElement>('[data-repeat-summary]')!;

    it('starts finished options and risks folded when coming back', () => {
      const form = setUp({options: [option], risks: [risk]});
      const [firstOption] = entries(form, 'options');
      const [firstRisk] = entries(form, 'risks');
      expect(folded(firstOption)).toBe(true);
      expect(summary(firstOption).textContent).toBe('Build our own · £1,022.20Edit');
      expect(folded(firstRisk)).toBe(true);
      expect(summary(firstRisk).textContent).toBe(
        'Tipping over · risk 12, 4 once reducedEdit'
      );
    });

    it('leaves blank and unfinished ones open', () => {
      const form = setUp({risks: [{...risk, residualProbability: ''}]});
      expect(folded(entries(form, 'options')[0])).toBe(false);
      expect(folded(entries(form, 'risks')[0])).toBe(false);
    });

    it('folds an option once it is finished and focus moves on', () => {
      const form = setUp();
      const description = form.querySelector<HTMLInputElement>(
        '[name="proposal[options][0][description]"]'
      )!;
      description.value = 'Buy a rack';
      form.querySelector<HTMLInputElement>(
        '[name="proposal[options][0][cost]"]'
      )!.value = '1400';
      description.focus();
      form.querySelector<HTMLTextAreaElement>('[name="proposal[preferred]"]')!.focus();
      expect(folded(entries(form, 'options')[0])).toBe(true);
      expect(summary(entries(form, 'options')[0]).textContent).toContain(
        'Buy a rack · £1,400'
      );
    });

    it('opens a folded one to edit when its line is clicked', () => {
      const form = setUp({options: [option]});
      const [first] = entries(form, 'options');
      summary(first).click();
      expect(folded(first)).toBe(false);
      expect(document.activeElement?.getAttribute('name')).toBe(
        'proposal[options][0][description]'
      );
    });

    it('opens a folded one holding a field the browser says is missing', () => {
      const form = setUp({options: [option]});
      const [first] = entries(form, 'options');
      const cost = first.querySelector<HTMLInputElement>('[name$="[cost]"]')!;
      cost.value = '';
      cost.dispatchEvent(new Event('invalid'));
      expect(folded(first)).toBe(false);
    });
  });

  describe('the options section', () => {
    const section = (form: HTMLFormElement) =>
      form.querySelector<HTMLDetailsElement>('[data-proposal-section]')!;
    const count = (form: HTMLFormElement) =>
      section(form).querySelector('[data-section-count]')!.textContent;

    it('starts closed, saying none have been added', () => {
      const form = setUp();
      expect(section(form).open).toBe(false);
      expect(count(form)).toBe('none added yet');
    });

    it('says how many options have been added', () => {
      const form = setUp({
        options: [
          {description: 'Build', pros: '', cons: '', cost: '100'},
          {description: 'Buy', pros: '', cons: '', cost: '200'},
        ],
      });
      expect(count(form)).toBe('2 added');
    });

    it('opens when a field in it is flagged as missing', () => {
      const form = setUp();
      const description = form.querySelector<HTMLInputElement>(
        '[name="proposal[options][0][description]"]'
      )!;
      description.dispatchEvent(new Event('invalid'));
      expect(section(form).open).toBe(true);
    });
  });
});
