// The purchase request form, kept in this one file so the design can be
// swapped out wholesale. It is filled in a page at a time, like the Owners'
// Agreement, using the shared pieces in src/templates/multi-page-form.ts:
//
//   1. About the request: which purchasing area, a summary, why it's needed.
//   2. Costs and budget: the area's budget as it stands; each shop, the
//      items wanted from it (link, SKU, quantity, cost, notes) and any
//      delivery - together the cost of the request; whether it is a
//      consumable members pay for; and, as those are filled in, which budget
//      it comes out of and whether it needs a proposal.
//   3. Check and send: everything in one summary, with the budget worked out
//      on the server, before sending.
//
// Pages 1 and 2 move on with a GET form carrying the answers so far; page 3
// posts everything to the submit command, which works the outcome out again
// itself (src/purchasing/classify-purchase.ts). Which page to show, and what
// is still missing, is decided in submit-form.ts. Everything works without
// JavaScript; on page 2 a small script adds, removes and folds shops and
// items, keeps running totals and shows the budget result.
// Its styles are the `.purchase-request` rules in src/static/styles.css.

import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {Classification} from '../../purchasing/classify-purchase';
import {
  Purchase,
  TypedItem,
  TypedPurchase,
} from '../../purchasing/purchases';
import {renderPurchaseBreakdown} from '../../templates/purchase-breakdown';
import {renderOutcome} from '../../templates/purchase-request-outcome';
import {
  PROBABILITY_SCALE,
  SEVERITY_SCALE,
  TypedProposal,
  TypedRisk,
} from '../../purchasing/proposal';
import {
  backHref,
  hiddenInputs,
  renderStepNav,
  renderStepProgress,
  StepValues,
} from '../../templates/multi-page-form';

export const PAGE_LABELS = [
  'About the request',
  'Costs and budget',
  'Check and send',
] as const;

export type PurchasingAreaOption = {
  id: UUID;
  name: string;
  areaIds: ReadonlyArray<UUID>;
  areaNames: ReadonlyArray<string>;
  yearlyBudgetPence: number;
  spentThisYearPence: number;
  remainingPence: number;
};

// As typed so far, carried from page to page.
export type PurchaseRequestAnswers = {
  purchasingAreaId: string;
  summary: string;
  justification: string;
  // The shops and their items as typed, blank ones already left out.
  purchases: ReadonlyArray<TypedPurchase>;
  isMemberPaidConsumable: string;
  affectsOtherAreas: string;
  // The other areas ticked, by id.
  affectedAreaIds: ReadonlyArray<string>;
  healthAndSafetyRisk: string;
  // The proposal as typed, if the form comes back with one.
  proposal: TypedProposal;
};

export type PurchaseRequestFormViewModel = {
  requestId: UUID;
  budgetYear: number;
  // Only the purchasing areas this member may submit for.
  purchasingAreas: ReadonlyArray<PurchasingAreaOption>;
  // A single budget purchase of this much or more needs a proposal.
  proposalThresholdPence: number;
  step: number;
  answers: PurchaseRequestAnswers;
  // What still needs sorting out, when they asked for a later page.
  problems: ReadonlyArray<string>;
  // Known from page 2 on.
  chosen: O.Option<PurchasingAreaOption>;
  // Areas outside the chosen purchasing area, which it might affect.
  otherAreas: ReadonlyArray<{id: UUID; name: string}>;
  // Known on page 3: the shops, their total, and what that means.
  result: O.Option<{
    purchases: ReadonlyArray<Purchase>;
    totalPence: number;
    affectedAreaNames: ReadonlyArray<string>;
    classification: Classification;
  }>;
};

// "£420" for whole pounds, "£420.50" otherwise - as the prototype shows money.
const gbp = (pence: number) =>
  sanitizeString(
    '£' +
      (pence / 100).toLocaleString('en-GB', {
        minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })
  );

const percent = (part: number, whole: number) =>
  safe(((part / whole) * 100).toFixed(2));

// Spent so far. The bar's full width is the yearly budget, so the budget
// line is only drawn when spending has gone past it.
const renderBar = (
  purchasingArea: PurchasingAreaOption,
  budgetYear: number
) => {
  const overBudget =
    purchasingArea.spentThisYearPence > purchasingArea.yearlyBudgetPence;
  const scale =
    Math.max(
      purchasingArea.yearlyBudgetPence,
      purchasingArea.spentThisYearPence
    ) || 1;
  return html`
    <div
      class="purchase-bar"
      role="img"
      aria-label="${gbp(purchasingArea.spentThisYearPence)} spent, of a ${gbp(
        purchasingArea.yearlyBudgetPence
      )} budget"
    >
      <div
        class="purchase-bar__spent"
        style="width:${percent(purchasingArea.spentThisYearPence, scale)}%"
      ></div>
      ${overBudget
        ? html`<div
            class="purchase-bar__limit"
            style="left:calc(${percent(
              purchasingArea.yearlyBudgetPence,
              scale
            )}% - 3px)"
          ></div>`
        : html``}
    </div>
    <div class="purchase-bar-legend">
      <span
        ><span class="purchase-swatch purchase-swatch--spent"></span>Spent in
        ${budgetYear}</span
      >
      ${overBudget
        ? html`<span
            ><span class="purchase-swatch purchase-swatch--limit"></span>Yearly
            budget</span
          >`
        : html``}
    </div>
  `;
};

const renderBudget =
  (budgetYear: number) => (purchasingArea: PurchasingAreaOption) => html`
    <div
      class="purchase-budget"
      data-budget-for="${purchasingArea.id}"
      aria-live="polite"
    >
      <div class="purchase-request__tight">
        <strong
          >${sanitizeString(purchasingArea.name)} yearly budget,
          ${budgetYear}</strong
        >
        <span class="purchase-request__hint text-sm"
          >${purchasingArea.areaNames.length > 0
            ? html`Covers
              ${sanitizeString(purchasingArea.areaNames.join(' and '))}. `
            : html``}Resets on 1 January.</span
        >
      </div>
      <dl>
        <div>
          <dt>Yearly budget</dt>
          <dd>${gbp(purchasingArea.yearlyBudgetPence)}</dd>
        </div>
        <div>
          <dt>Spent so far</dt>
          <dd>${gbp(purchasingArea.spentThisYearPence)}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>${gbp(Math.max(purchasingArea.remainingPence, 0))}</dd>
        </div>
      </dl>
      <div data-budget-bar>${renderBar(purchasingArea, budgetYear)}</div>
    </div>
  `;

// Blank entries offered without JavaScript; blank ones are ignored.
const SHOP_ENTRIES = 2;
const ITEM_ENTRIES = 3;

const blankItem: TypedItem = {url: '', sku: '', quantity: '', cost: '', notes: ''};
const blankShop: TypedPurchase = {shop: '', delivery: '', items: []};

// Typed entries first, then blanks up to the minimum.
const padded = <A>(typed: ReadonlyArray<A>, minimum: number, blank: A) => [
  ...typed,
  ...Array.from({length: Math.max(minimum - typed.length, 0)}, () => blank),
];

const itemFields = ['url', 'sku', 'quantity', 'cost', 'notes'] as const;

const renderItemEntry =
  (shopIndex: number) => (item: TypedItem, itemIndex: number) => {
    const name = (field: (typeof itemFields)[number]) =>
      safe(`purchases[${shopIndex}][items][${itemIndex}][${field}]`);
    const id = (field: (typeof itemFields)[number]) =>
      safe(`purchases-${shopIndex}-items-${itemIndex}-${field}`);
    const required =
      shopIndex === 0 && itemIndex === 0 ? safe('required') : safe('');
    return html`
      <div class="purchase-item" data-item-entry>
        <div class="purchase-item__head">
          <strong data-item-title>Item ${itemIndex + 1}</strong>
          <button
            class="purchase-request__link-button jsonly"
            type="button"
            data-remove-item
            hidden
          >
            Remove item
          </button>
        </div>
        <button
          class="purchase-item__summary"
          type="button"
          data-item-summary
          aria-expanded="false"
          hidden
        ></button>
        <div class="purchase-item__body" data-item-body>
        <div class="purchase-field">
          <label class="purchase-field__label" for="${id('url')}">Link</label>
          <input
            type="text"
            inputmode="url"
            name="${name('url')}"
            id="${id('url')}"
            placeholder="https://"
            value="${sanitizeString(item.url)}"
          />
        </div>
        <div class="purchase-item__row">
          <div class="purchase-field">
            <label class="purchase-field__label" for="${id('sku')}">SKU</label>
            <input
              type="text"
              name="${name('sku')}"
              id="${id('sku')}"
              value="${sanitizeString(item.sku)}"
            />
          </div>
          <div class="purchase-field">
            <label class="purchase-field__label" for="${id('quantity')}"
              >Quantity</label
            >
            <input
              type="text"
              inputmode="numeric"
              name="${name('quantity')}"
              id="${id('quantity')}"
              value="${sanitizeString(item.quantity)}"
              data-item-quantity
              ${required}
            />
          </div>
          <div class="purchase-field">
            <label class="purchase-field__label" for="${id('cost')}"
              >Total cost (inc. VAT)</label
            >
            <div class="purchase-money">
              <span>£</span
              ><input
                type="text"
                inputmode="decimal"
                name="${name('cost')}"
                id="${id('cost')}"
                placeholder="0.00"
                value="${sanitizeString(item.cost)}"
                aria-describedby="${id('cost')}-hint"
                data-item-cost
                ${required}
              />
            </div>
            <span
              class="purchase-request__hint text-sm"
              id="${id('cost')}-hint"
              >The total for the whole quantity, including VAT and after any
              discount - not the price of one.</span
            >
          </div>
        </div>
        <div class="purchase-field">
          <label class="purchase-field__label" for="${id('notes')}"
            >Notes
            <span class="purchase-request__hint purchase-request__normal"
              >(important)</span
            ></label
          >
          <span class="purchase-request__hint text-sm" id="${id('notes')}-hint"
            >Please explain in all possible detail what the item is - lengths,
            widths, weight, connections, whatever options are available in the
            online store that are important for you.</span
          >
          <textarea
            name="${name('notes')}"
            id="${id('notes')}"
            rows="3"
            aria-describedby="${id('notes')}-hint"
          >
${sanitizeString(item.notes)}</textarea
          >
        </div>
        <div class="purchase-item__actions jsonly" data-item-actions hidden>
          <button type="button" data-item-done>Add item</button>
          <span
            class="purchase-request__hint text-sm"
            data-item-message
            aria-live="polite"
          ></span>
        </div>
        </div>
      </div>
    `;
  };

const renderShopEntry = (shop: TypedPurchase, shopIndex: number) => html`
  <div class="purchase-shop" data-shop-entry data-shop-index="${shopIndex}">
    <div class="purchase-shop__head">
      <strong data-shop-title>Shop ${shopIndex + 1}</strong>
      <button
        class="purchase-request__link-button jsonly"
        type="button"
        data-remove-shop
        hidden
      >
        Remove shop
      </button>
    </div>
    <button
      class="purchase-item__summary purchase-shop__summary"
      type="button"
      data-shop-summary
      aria-expanded="false"
      hidden
    ></button>
    <div class="purchase-shop__row" data-shop-fields>
      <div class="purchase-field">
        <label class="purchase-field__label" for="purchases-${shopIndex}-shop"
          >Shop or website</label
        >
        <input
          type="text"
          name="purchases[${shopIndex}][shop]"
          id="purchases-${shopIndex}-shop"
          placeholder="e.g. jewson.co.uk"
          value="${sanitizeString(shop.shop)}"
          ${shopIndex === 0 ? safe('required') : safe('')}
        />
      </div>
      <div class="purchase-field">
        <label
          class="purchase-field__label"
          for="purchases-${shopIndex}-delivery"
          >Delivery
          <span class="purchase-request__hint purchase-request__normal"
            >(optional)</span
          ></label
        >
        <div class="purchase-money">
          <span>£</span
          ><input
            type="text"
            inputmode="decimal"
            name="purchases[${shopIndex}][delivery]"
            id="purchases-${shopIndex}-delivery"
            placeholder="0.00"
            value="${sanitizeString(shop.delivery)}"
            data-shop-delivery
          />
        </div>
      </div>
    </div>
    <div class="purchase-shop__items" data-item-entries>
      ${joinHtml(
        padded(shop.items, ITEM_ENTRIES, blankItem).map(
          renderItemEntry(shopIndex)
        )
      )}
    </div>
    <button
      class="purchase-request__link-button jsonly"
      type="button"
      data-add-item
    >
      + Add another item from this shop
    </button>
    <div class="purchase-shop__total" data-shop-total aria-live="polite"></div>
  </div>
`;

// The shops and items as carried between pages: numbered from 0 in order.
const purchaseValues = (
  purchases: ReadonlyArray<TypedPurchase>
): StepValues =>
  purchases.flatMap((purchase, shopIndex) => [
    [`purchases[${shopIndex}][shop]`, purchase.shop] as const,
    [`purchases[${shopIndex}][delivery]`, purchase.delivery] as const,
    ...purchase.items.flatMap((item, itemIndex) =>
      itemFields.map(
        field =>
          [
            `purchases[${shopIndex}][items][${itemIndex}][${field}]`,
            item[field],
          ] as const
      )
    ),
  ]);

// Every answer so far, in page order, to carry to another page.
const carried = ({
  requestId,
  answers,
}: PurchaseRequestFormViewModel): StepValues =>
  [
    ['id', requestId] as const,
    ['purchasingAreaId', answers.purchasingAreaId] as const,
    ['summary', answers.summary] as const,
    ['justification', answers.justification] as const,
    ...purchaseValues(answers.purchases),
    ['isMemberPaidConsumable', answers.isMemberPaidConsumable] as const,
    ['affectsOtherAreas', answers.affectsOtherAreas] as const,
    ...answers.affectedAreaIds.map(id => ['affectedAreaIds', id] as const),
    ['healthAndSafetyRisk', answers.healthAndSafetyRisk] as const,
  ].filter(([, value]) => value !== '');

// Which of the page 2 questions a name belongs to.
const askedOnCostsPage = (name: string) =>
  name.startsWith('purchases[') ||
  [
    'isMemberPaidConsumable',
    'affectsOtherAreas',
    'affectedAreaIds',
    'healthAndSafetyRisk',
  ].includes(name);

// Everything but what the page itself asks for.
const carriedExcept = (
  viewModel: PurchaseRequestFormViewModel,
  asks: (name: string) => boolean
): StepValues => carried(viewModel).filter(([name]) => !asks(name));

const checkedIf = (condition: boolean) => (condition ? safe('checked') : '');

const renderProblems = ({problems}: PurchaseRequestFormViewModel) =>
  problems.length > 0
    ? html`<div class="callout callout--red" role="alert">
        ${joinHtml(problems.map(problem => html`<p>${sanitizeString(problem)}</p>`))}
      </div>`
    : html``;

const renderNext = (viewModel: PurchaseRequestFormViewModel) =>
  renderStepNav({
    back: backHref(viewModel.step, carried(viewModel)),
    next: html`<button type="submit">
      Next: ${safe(PAGE_LABELS[viewModel.step])}
    </button>`,
  });

const renderAreaRadio =
  (answers: PurchaseRequestAnswers) =>
  (purchasingArea: PurchasingAreaOption) => html`
    <div class="fieldset-item">
      <input
        type="radio"
        name="purchasingAreaId"
        id="area-${purchasingArea.id}"
        value="${purchasingArea.id}"
        required
        ${checkedIf(answers.purchasingAreaId === purchasingArea.id)}
      />
      <label for="area-${purchasingArea.id}">
        <span>${sanitizeString(purchasingArea.name)}</span>
        ${purchasingArea.areaNames.length > 1
          ? html`<span class="purchase-request__hint text-sm"
              >Shared budget:
              ${sanitizeString(purchasingArea.areaNames.join(' and '))}</span
            >`
          : html``}
      </label>
    </div>
  `;

const renderAboutPage = (viewModel: PurchaseRequestFormViewModel) => html`
  <form method="get" class="purchase-request__sections">
    <input type="hidden" name="step" value="2" />
    ${hiddenInputs(
      carriedExcept(viewModel, name =>
        ['purchasingAreaId', 'summary', 'justification'].includes(name)
      )
    )}
    <fieldset class="purchase-request__fieldset">
      <legend>Which area is this for?</legend>
      <p class="purchase-request__hint text-sm">
        You can request purchases for areas you own.
      </p>
      <div class="purchase-request__radios purchase-request__radios--areas">
        ${joinHtml(
          viewModel.purchasingAreas.map(renderAreaRadio(viewModel.answers))
        )}
      </div>
    </fieldset>
    <div class="purchase-field">
      <label class="purchase-field__label" for="summary">Summary</label>
      <span class="purchase-request__hint text-sm"
        >A short name for the request as a whole.</span
      >
      <input
        type="text"
        name="summary"
        id="summary"
        placeholder="e.g. New table saw blades and a blade guard"
        value="${sanitizeString(viewModel.answers.summary)}"
        required
      />
    </div>
    <div class="purchase-field">
      <label class="purchase-field__label" for="justification"
        >Why is it needed?</label
      >
      <span class="purchase-request__hint text-sm"
        >A sentence or two for the people who sign off spending.</span
      >
      <textarea name="justification" id="justification" required>
${sanitizeString(viewModel.answers.justification)}</textarea
      >
    </div>
    ${renderNext(viewModel)}
  </form>
`;

// A request's verdict on the page: where the money comes from, and whether a
// proposal is needed - which a consumable can need too.
type VerdictKey = Classification['outcome'] | 'consumable-proposal-needed';

const verdictStyle: Record<
  VerdictKey,
  {modifier: string; tag: Html; heading: string}
> = {
  consumable: {
    modifier: 'consumable',
    tag: html`<span class="tag tag--green">Paid for by members</span>`,
    heading: "This doesn't come out of your yearly budget",
  },
  budget: {
    modifier: 'budget',
    tag: html`<span class="tag tag--yellow">Yearly budget</span>`,
    heading: 'This comes out of your yearly budget. No proposal needed.',
  },
  'budget-proposal-needed': {
    modifier: 'proposal',
    tag: html`<span class="tag tag--red">Yearly budget · Proposal needed</span>`,
    heading: "You'll need to write a proposal",
  },
  'consumable-proposal-needed': {
    modifier: 'proposal',
    tag: html`<span class="tag tag--red"
      >Paid for by members · Proposal needed</span
    >`,
    heading:
      "This doesn't come out of your yearly budget, but you'll need to write a proposal",
  },
};

// One outcome's box: its colour, tag and heading, with the explanation and
// anything else below.
const renderVerdictBox = (
  outcome: VerdictKey,
  subtitle: Html,
  reason: Html,
  extra: Html = html``
) => {
  const style = verdictStyle[outcome];
  return html`
    <div class="purchase-verdict purchase-verdict--${safe(style.modifier)}">
      <span class="purchase-request__hint text-sm">${subtitle}</span>
      <span>${style.tag}</span>
      <h2>${safe(style.heading)}</h2>
      <p>${reason}</p>
      ${extra}
    </div>
  `;
};

const verdictKeys: ReadonlyArray<VerdictKey> = [
  'consumable',
  'consumable-proposal-needed',
  'budget',
  'budget-proposal-needed',
];

const renderCostsPage = (viewModel: PurchaseRequestFormViewModel) => html`
  <form
    method="get"
    class="purchase-request__sections"
    id="purchase-costs-form"
    data-proposal-threshold-pence="${viewModel.proposalThresholdPence}"
    ${pipe(
      viewModel.chosen,
      O.match(
        () => html``,
        area =>
          html`data-budget-pence="${area.yearlyBudgetPence}"
          data-spent-pence="${area.spentThisYearPence}"`
      )
    )}
  >
    <input type="hidden" name="step" value="3" />
    ${hiddenInputs(
      carriedExcept(viewModel, askedOnCostsPage)
    )}
    ${pipe(
      viewModel.chosen,
      O.match(() => html``, renderBudget(viewModel.budgetYear))
    )}
    <div class="purchase-request__stack">
      <h2>What are you buying, and where from?</h2>
      <p class="purchase-request__hint text-sm">
        Start with the shop or website, then add each item you want from it,
        with what it costs for that quantity, including VAT and any bulk
        discount. Add another shop if some things come from
        somewhere else. Together they make the cost of the request.
      </p>
      <div class="purchase-request__stack" data-shop-entries>
        ${joinHtml(
          padded(viewModel.answers.purchases, SHOP_ENTRIES, blankShop).map(
            renderShopEntry
          )
        )}
      </div>
      <button
        class="purchase-request__link-button jsonly"
        type="button"
        data-add-shop
      >
        + Add another shop
      </button>
      <div data-request-total aria-live="polite"></div>
    </div>
    <fieldset class="purchase-request__fieldset purchase-question">
      <legend>Do members pay for this on SumUp?</legend>
      <p class="purchase-request__hint text-sm">
        For example, 3D printer filament, paid for on SumUp when it's used.
      </p>
      <div class="purchase-request__radios purchase-request__radios--inline">
        <div class="fieldset-item">
          <input
            type="radio"
            name="isMemberPaidConsumable"
            id="consumable-yes"
            value="true"
            required
            ${checkedIf(viewModel.answers.isMemberPaidConsumable === 'true')}
          />
          <label for="consumable-yes">Yes</label>
        </div>
        <div class="fieldset-item">
          <input
            type="radio"
            name="isMemberPaidConsumable"
            id="consumable-no"
            value="false"
            required
            ${checkedIf(viewModel.answers.isMemberPaidConsumable === 'false')}
          />
          <label for="consumable-no">No</label>
        </div>
      </div>
    </fieldset>
    <fieldset class="purchase-request__fieldset purchase-question">
      <legend>Will this affect any other areas?</legend>
      <p class="purchase-request__hint text-sm">
        For example by using shared space, changing a shared machine, or being
        noisy or messy nearby. Their owners will need a chance to give their
        input, so it will need a proposal.
      </p>
      <div class="purchase-request__radios purchase-request__radios--inline">
        <div class="fieldset-item">
          <input
            type="radio"
            name="affectsOtherAreas"
            id="affects-yes"
            value="true"
            required
            ${checkedIf(viewModel.answers.affectsOtherAreas === 'true')}
          />
          <label for="affects-yes">Yes</label>
        </div>
        <div class="fieldset-item">
          <input
            type="radio"
            name="affectsOtherAreas"
            id="affects-no"
            value="false"
            required
            ${checkedIf(viewModel.answers.affectsOtherAreas === 'false')}
          />
          <label for="affects-no">No</label>
        </div>
      </div>
      <fieldset class="purchase-request__fieldset purchase-other-areas" data-other-areas>
        <legend class="purchase-field__label">Which areas?</legend>
        <ul class="purchase-checkboxes">
          ${joinHtml(
            viewModel.otherAreas.map(
              area => html`<li>
                <label class="purchase-checkbox">
                  <input
                    type="checkbox"
                    name="affectedAreaIds"
                    value="${area.id}"
                    ${checkedIf(viewModel.answers.affectedAreaIds.includes(area.id))}
                  />
                  <span data-area-name>${sanitizeString(area.name)}</span>
                </label>
              </li>`
            )
          )}
        </ul>
      </fieldset>
    </fieldset>
    <fieldset class="purchase-request__fieldset purchase-question">
      <legend>
        Does it present a moderate to high health and safety risk that will
        need to be mitigated?
      </legend>
      <p class="purchase-request__hint text-sm">
        If so, it will need a proposal that includes a risk assessment.
      </p>
      <div class="purchase-request__radios purchase-request__radios--inline">
        <div class="fieldset-item">
          <input
            type="radio"
            name="healthAndSafetyRisk"
            id="risk-yes"
            value="true"
            required
            ${checkedIf(viewModel.answers.healthAndSafetyRisk === 'true')}
          />
          <label for="risk-yes">Yes</label>
        </div>
        <div class="fieldset-item">
          <input
            type="radio"
            name="healthAndSafetyRisk"
            id="risk-no"
            value="false"
            required
            ${checkedIf(viewModel.answers.healthAndSafetyRisk === 'false')}
          />
          <label for="risk-no">No</label>
        </div>
      </div>
    </fieldset>
    <div data-budget-verdict hidden aria-live="polite"></div>
    ${joinHtml(
      verdictKeys.map(
        outcome =>
          html`<template data-verdict-template="${safe(outcome)}"
            >${renderVerdictBox(
              outcome,
              html`For the <span data-verdict-total></span> total`,
              html`<span data-verdict-reason></span>`
            )}</template
          >`
      )
    )}
    ${renderNext(viewModel)}
  </form>
  ${costsScript}
`;

const renderCheckPage = (viewModel: PurchaseRequestFormViewModel) => html`
  <p>Check the request, then send it.</p>
  ${pipe(
    viewModel.result,
    O.match(
      () => html``,
      ({purchases, totalPence, affectedAreaNames, classification}) => html`
        <dl class="purchase-summary">
          <dt>Area</dt>
          <dd>
            ${pipe(
              viewModel.chosen,
              O.match(
                () => html``,
                area => html`${sanitizeString(area.name)}`
              )
            )}
          </dd>
          <dt>Summary</dt>
          <dd>${sanitizeString(viewModel.answers.summary)}</dd>
          <dt>Why it's needed</dt>
          <dd>${sanitizeString(viewModel.answers.justification)}</dd>
          <dt>Total</dt>
          <dd>${gbp(totalPence)}</dd>
          <dt>Other areas</dt>
          <dd>
            ${affectedAreaNames.length > 0
              ? sanitizeString(affectedAreaNames.join(', '))
              : html`None`}
          </dd>
          <dt>Health and safety</dt>
          <dd>
            ${viewModel.answers.healthAndSafetyRisk === 'true'
              ? html`Moderate to high risk; needs a risk assessment`
              : html`No moderate or high risk`}
          </dd>
          <dt>Budget</dt>
          <dd>${renderOutcome(classification.outcome, classification.approval)}</dd>
          <dt>Why</dt>
          <dd>${sanitizeString(classification.reason)}</dd>
        </dl>
        ${renderPurchaseBreakdown(purchases, totalPence)}
      `
    )
  )}
  <form
    action="/purchase-requests/submit?next=${safe(
      encodeURIComponent(`/purchase-requests/view/${viewModel.requestId}?sent=1`)
    )}"
    method="post"
    class="purchase-request__sections"
    id="purchase-check-form"
  >
    ${hiddenInputs(carried(viewModel))}
    ${pipe(
      viewModel.result,
      O.filter(({classification}) => classification.approval === 'proposal'),
      O.match(
        () => html``,
        () => renderProposalForm(viewModel)
      )
    )}
    ${renderStepNav({
      back: backHref(viewModel.step, carried(viewModel)),
      next: html`<button type="submit">Send request</button>`,
    })}
  </form>
  ${proposalScript}
`;

// Blank options and risks offered without JavaScript; blank ones are ignored.
const PROPOSAL_ENTRIES = 3;

const textField = (
  name: string,
  label: Html,
  hint: Html,
  value: string,
  options: {required?: boolean; rows?: number} = {}
) => {
  const id = safe(name.replace(/[[\]]+/g, '-').replace(/-$/, ''));
  return html`
    <div class="purchase-field">
      <label class="purchase-field__label" for="${id}">${label}</label>
      ${hint ? html`<span class="purchase-request__hint text-sm">${hint}</span>` : html``}
      <textarea
        name="${safe(name)}"
        id="${id}"
        rows="${options.rows ?? 4}"
        ${options.required ? safe('required') : safe('')}
      >
${sanitizeString(value)}</textarea
      >
    </div>
  `;
};

const optionalLabel = (text: string) => html`${safe(text)}
  <span class="purchase-request__hint purchase-request__normal"
    >(optional)</span
  >`;

const renderOptionEntry = (
  option: TypedProposal['options'][number],
  index: number
) => {
  const name = (field: string) => `proposal[options][${index}][${field}]`;
  const id = (field: string) => safe(`proposal-options-${index}-${field}`);
  // Options are optional, so none of their fields is required up front;
  // the server still needs a description and cost for any option given.
  const required = safe('');
  return html`
    <div class="purchase-shop proposal-entry" data-repeat-entry>
      <div class="purchase-shop__head">
        <strong data-repeat-title>Option ${index + 1}</strong>
        <button
          class="purchase-request__link-button jsonly"
          type="button"
          data-repeat-remove
          hidden
        >
          Remove option
        </button>
      </div>
      <button
        class="purchase-item__summary"
        type="button"
        data-repeat-summary
        aria-expanded="false"
        hidden
      ></button>
      <div class="proposal-entry__body" data-repeat-body>
      <div class="purchase-shop__row">
        <div class="purchase-field">
          <label class="purchase-field__label" for="${id('description')}"
            >What is the option?</label
          >
          <input
            type="text"
            name="${safe(name('description'))}"
            id="${id('description')}"
            value="${sanitizeString(option.description)}"
            ${required}
          />
        </div>
        <div class="purchase-field">
          <label class="purchase-field__label" for="${id('cost')}"
            >Cost</label
          >
          <div class="purchase-money">
            <span>£</span
            ><input
              type="text"
              inputmode="decimal"
              name="${safe(name('cost'))}"
              id="${id('cost')}"
              placeholder="0.00"
              value="${sanitizeString(option.cost)}"
              ${required}
            />
          </div>
        </div>
      </div>
      ${textField(name('pros'), html`Pros`, html``, option.pros, {rows: 3})}
      ${textField(name('cons'), html`Cons`, html``, option.cons, {rows: 3})}
      </div>
    </div>
  `;
};

const ratingField = (
  name: string,
  label: Html,
  hint: Html,
  scale: ReadonlyArray<string>,
  value: string,
  required: boolean
) => {
  const id = safe(name.replace(/[[\]]+/g, '-').replace(/-$/, ''));
  return html`
    <div class="purchase-field">
      <label class="purchase-field__label" for="${id}">${label}</label>
      <span class="purchase-request__hint text-sm">${hint}</span>
      <select
        class="proposal-rating"
        name="${safe(name)}"
        id="${id}"
        ${required ? safe('required') : safe('')}
      >
        <option value="">Choose 1 to 5</option>
        ${joinHtml(
          scale.map(
            (description, index) => html`<option
              value="${index + 1}"
              ${value === String(index + 1) ? safe('selected') : safe('')}
            >
              ${index + 1} - ${safe(description)}
            </option>`
          )
        )}
      </select>
    </div>
  `;
};

// Severity and probability side by side, before or after the actions.
const renderRatings = (
  name: (field: string) => string,
  risk: TypedRisk,
  fields: {severity: 'severity' | 'residualSeverity'; probability: 'probability' | 'residualProbability'},
  after: boolean,
  required: boolean
) => html`
  <div class="proposal-ratings">
    ${ratingField(
      name(fields.severity),
      after ? html`Severity once those are done` : html`Severity`,
      html`If something goes wrong, how bad will it be?`,
      SEVERITY_SCALE,
      risk[fields.severity],
      required
    )}
    ${ratingField(
      name(fields.probability),
      after ? html`Probability once those are done` : html`Probability`,
      html`How likely is it to actually happen?`,
      PROBABILITY_SCALE,
      risk[fields.probability],
      required
    )}
  </div>
`;

const renderRiskEntry = (risk: TypedRisk, index: number) => {
  const name = (field: string) => `proposal[risks][${index}][${field}]`;
  const required = index === 0;
  return html`
    <div class="purchase-shop proposal-entry" data-repeat-entry>
      <div class="purchase-shop__head">
        <strong data-repeat-title>Risk ${index + 1}</strong>
        <button
          class="purchase-request__link-button jsonly"
          type="button"
          data-repeat-remove
          hidden
        >
          Remove risk
        </button>
      </div>
      <button
        class="purchase-item__summary"
        type="button"
        data-repeat-summary
        aria-expanded="false"
        hidden
      ></button>
      <div class="proposal-entry__body" data-repeat-body>
      ${textField(
        name('hazard'),
        html`Hazard`,
        html`What could go wrong, e.g. dust, noise, sharp blades, heat.`,
        risk.hazard,
        {required, rows: 2}
      )}
      ${textField(
        name('harm'),
        html`Who could be harmed, and how`,
        html`What's the scope of the risk? Is it just to the user, people in
          the surrounding area, equipment, infrastructure?`,
        risk.harm,
        {rows: 2}
      )}
      ${renderRatings(
        name,
        risk,
        {severity: 'severity', probability: 'probability'},
        false,
        required
      )}
      ${textField(
        name('actions'),
        html`Remedial actions`,
        html`What will be done to reduce both the probability and severity,
          e.g. guards, extraction, PPE, training, signage.`,
        risk.actions,
        {required, rows: 3}
      )}
      ${renderRatings(
        name,
        risk,
        {severity: 'residualSeverity', probability: 'residualProbability'},
        true,
        required
      )}
      </div>
    </div>
  `;
};

const blankOption = {description: '', pros: '', cons: '', cost: ''};
const blankRisk: TypedRisk = {
  hazard: '',
  harm: '',
  severity: '',
  probability: '',
  actions: '',
  residualSeverity: '',
  residualProbability: '',
};

// The proposal, filled in before sending when the request needs one. The
// parts that don't apply to every purchase are optional; the risk assessment
// only appears for a moderate to high health and safety risk.
// One part of the proposal, set apart from the others with a rule above it.
const proposalSection = (body: Html) => html`
  <section class="proposal-form__section">${body}</section>
`;

const renderProposalForm = (viewModel: PurchaseRequestFormViewModel) => {
  const proposal = viewModel.answers.proposal;
  const needsRiskAssessment = viewModel.answers.healthAndSafetyRisk === 'true';
  return html`
    <section class="purchase-request__stack proposal-form" data-proposal-form>
      <h2>Your proposal</h2>
      <p>
        This request needs a proposal, sent with it. Fill in what applies; the
        parts marked optional can be left blank if they don't.
      </p>
      ${proposalSection(
        textField(
          'proposal[need]',
          html`The need`,
          html`What problem does this solve, and for whom?`,
          proposal.need || viewModel.answers.justification,
          {required: true, rows: 5}
        )
      )}
      ${proposalSection(html`
        <details class="proposal-section" data-proposal-section open>
          <summary class="proposal-section__summary">
            <span class="proposal-section__title">
              <h3>Options</h3>
              <span class="purchase-request__hint">(optional)</span>
              <span class="proposal-section__count" data-section-count></span>
            </span>
            <span class="proposal-section__why">
              Your proposal is more likely to be accepted if you show that
              you've considered multiple options and settled on one for a
              particular reason. Give each its pros, cons and cost - doing
              nothing can be one of them.
            </span>
            <span class="proposal-section__toggle" aria-hidden="true">
              <span class="proposal-section__when-closed">Add options</span>
              <span class="proposal-section__when-open">Hide options</span>
            </span>
          </summary>
          <div class="purchase-request__stack">
            <div
              class="purchase-request__stack"
              data-repeat="options"
              data-repeat-label="Option"
            >
              ${joinHtml(
                padded(proposal.options, PROPOSAL_ENTRIES, blankOption).map(
                  renderOptionEntry
                )
              )}
            </div>
            <button
              class="purchase-request__link-button jsonly"
              type="button"
              data-repeat-add="options"
            >
              + Add another option
            </button>
            ${textField(
              'proposal[preferred]',
              html`Preferred option`,
              html`Which option you'd go with, and why.`,
              proposal.preferred
            )}
          </div>
        </details>
      `)}
      ${needsRiskAssessment
        ? proposalSection(html`<div class="purchase-request__stack">
            <h3>Risk assessment</h3>
            <p class="purchase-request__hint text-sm">
              You said this presents a moderate to high health and safety risk.
              List each hazard, who it could harm, and what will be done about
              it.
            </p>
            <div
              class="purchase-request__stack"
              data-repeat="risks"
              data-repeat-label="Risk"
            >
              ${joinHtml(
                padded(proposal.risks, PROPOSAL_ENTRIES, blankRisk).map(
                  renderRiskEntry
                )
              )}
            </div>
            <button
              class="purchase-request__link-button jsonly"
              type="button"
              data-repeat-add="risks"
            >
              + Add another risk
            </button>
          </div>`)
        : html``}
      ${proposalSection(
        textField(
          'proposal[location]',
          optionalLabel('Where it goes'),
          html`Where in the space it will live.`,
          proposal.location
        )
      )}
      ${proposalSection(
        textField(
          'proposal[owner]',
          optionalLabel('Who owns it'),
          html`Who will look after it.`,
          proposal.owner
        )
      )}
      ${proposalSection(
        textField(
          'proposal[training]',
          optionalLabel('Training and servicing'),
          html`How members will be trained to use it, and how it will be
            serviced.`,
          proposal.training
        )
      )}
    </section>
  `;
};

// Plain browser JavaScript for page 3: adds and removes proposal options and
// risks. Kept free of template substitutions (so no backtick strings in it)
// and of single backslashes.
const proposalScript = html`
  <script>
    (function () {
      var form = document.getElementById('purchase-check-form');
      if (!form) return;

      function gbp(pence) {
        return '£' + (pence / 100).toLocaleString('en-GB', {
          minimumFractionDigits: pence % 100 ? 2 : 0,
          maximumFractionDigits: 2,
        });
      }
      function pence(value) {
        var cleaned = value.replace(/[£,\\s]/g, '');
        if (!/^\\d+(\\.\\d{1,2})?$/.test(cleaned)) return null;
        var parts = cleaned.split('.');
        return Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
      }
      function value(entry, field) {
        return entry.querySelector('[name$="[' + field + ']"]').value.trim();
      }
      function rated(entry, field) {
        return /^[1-5]$/.test(value(entry, field));
      }

      // A finished option or risk folds down to one line, so the whole
      // proposal is easy to see; unfinished ones stay open so nothing
      // missing is hidden. Each kind says what finished means and what its
      // line shows.
      var summaries = {
        options: function (entry) {
          var cost = pence(value(entry, 'cost'));
          if (!value(entry, 'description') || cost === null) return null;
          return value(entry, 'description') + ' · ' + gbp(cost);
        },
        risks: function (entry) {
          var fields = ['severity', 'probability', 'residualSeverity', 'residualProbability'];
          if (!value(entry, 'hazard') || !value(entry, 'actions') ||
              !fields.every(function (field) { return rated(entry, field); })) {
            return null;
          }
          var before = Number(value(entry, 'severity')) * Number(value(entry, 'probability'));
          var after = Number(value(entry, 'residualSeverity')) * Number(value(entry, 'residualProbability'));
          return value(entry, 'hazard') + ' · risk ' + before + ', ' + after + ' once reduced';
        },
      };
      function collapse(kind, entry) {
        var text = summaries[kind](entry);
        if (text === null) return;
        var summary = entry.querySelector('[data-repeat-summary]');
        summary.textContent = '';
        var line = document.createElement('span');
        line.textContent = text;
        var edit = document.createElement('span');
        edit.className = 'purchase-item__edit';
        edit.textContent = 'Edit';
        summary.appendChild(line);
        summary.appendChild(edit);
        summary.hidden = false;
        summary.setAttribute('aria-expanded', 'false');
        entry.querySelector('[data-repeat-body]').hidden = true;
        entry.classList.add('proposal-entry--collapsed');
      }
      function expand(entry) {
        entry.querySelector('[data-repeat-summary]').hidden = true;
        entry.querySelector('[data-repeat-summary]').setAttribute('aria-expanded', 'true');
        entry.querySelector('[data-repeat-body]').hidden = false;
        entry.classList.remove('proposal-entry--collapsed');
      }

      form.querySelectorAll('[data-repeat]').forEach(function (list) {
        var kind = list.dataset.repeat;
        var label = list.dataset.repeatLabel;
        var entries = list.querySelectorAll('[data-repeat-entry]');
        var template = entries[0].cloneNode(true);
        template.querySelectorAll('input, textarea, select').forEach(function (field) {
          field.value = '';
          if (field.tagName !== 'SELECT') field.textContent = '';
          field.querySelectorAll('option[selected]').forEach(function (option) {
            option.removeAttribute('selected');
          });
          field.required = false;
        });
        var next = entries.length;
        function isBlank(entry) {
          return Array.prototype.every.call(
            entry.querySelectorAll('input, textarea, select'),
            function (field) { return field.value.trim() === ''; }
          );
        }
        function renumber() {
          var all = list.querySelectorAll('[data-repeat-entry]');
          all.forEach(function (entry, index) {
            entry.querySelector('[data-repeat-title]').textContent = label + ' ' + (index + 1);
            entry.querySelector('[data-repeat-remove]').hidden = all.length < 2;
          });
        }
        function wire(entry) {
          entry.querySelector('[data-repeat-remove]').addEventListener('click', function () {
            entry.remove();
            renumber();
          });
          function open() {
            expand(entry);
            entry.querySelector('[data-repeat-body] input, [data-repeat-body] textarea').focus();
          }
          entry.querySelector('[data-repeat-summary]').addEventListener('focus', open);
          entry.querySelector('[data-repeat-summary]').addEventListener('click', open);
          entry.addEventListener('focusout', function (event) {
            if (!event.relatedTarget || !entry.contains(event.relatedTarget)) collapse(kind, entry);
          });
          collapse(kind, entry);
        }
        for (var i = 1; i < entries.length; i++) {
          if (isBlank(entries[i])) entries[i].remove();
        }
        list.querySelectorAll('[data-repeat-entry]').forEach(wire);
        form.querySelector('[data-repeat-add="' + kind + '"]').addEventListener('click', function () {
          var index = next++;
          var entry = template.cloneNode(true);
          entry.querySelectorAll('[name]').forEach(function (field) {
            field.name = field.name.replace(/\\[\\d+\\]/, '[' + index + ']');
            field.id = field.id.replace(/-[0-9]+-/, '-' + index + '-');
          });
          entry.querySelectorAll('label[for]').forEach(function (fieldLabel) {
            fieldLabel.htmlFor = fieldLabel.htmlFor.replace(/-[0-9]+-/, '-' + index + '-');
          });
          list.appendChild(entry);
          wire(entry);
          renumber();
          entry.querySelector('input, textarea').focus();
        });
        renumber();
      });

      // Sections like Options start closed (they're open without
      // JavaScript), saying how many have been added.
      var sections = form.querySelectorAll('[data-proposal-section]');
      function countSections() {
        sections.forEach(function (section) {
          var list = section.querySelector('[data-repeat]');
          var added = Array.prototype.filter.call(
            list.querySelectorAll('[data-repeat-entry]'),
            function (entry) { return summaries[list.dataset.repeat](entry) !== null; }
          ).length;
          section.querySelector('[data-section-count]').textContent =
            added ? added + ' added' : 'none added yet';
        });
      }
      sections.forEach(function (section) { section.open = false; });
      form.addEventListener('input', countSections);
      form.addEventListener('change', countSections);
      countSections();

      // A field the browser flags as missing opens the section and the entry
      // holding it.
      form.addEventListener('invalid', function (event) {
        var section = event.target.closest && event.target.closest('[data-proposal-section]');
        if (section) section.open = true;
        var entry = event.target.closest && event.target.closest('[data-repeat-entry]');
        if (entry) expand(entry);
      }, true);
    })();
  </script>
`;

// Plain browser JavaScript for page 2, kept free of template substitutions
// (so no backtick strings in it) and of single backslashes.
const costsScript = html`
  <script>
    (function () {
      var form = document.getElementById('purchase-costs-form');
      if (!form) return;
      var shops = form.querySelector('[data-shop-entries]');
      var requestTotal = form.querySelector('[data-request-total]');
      var verdict = form.querySelector('[data-budget-verdict]');
      var budget = Number(form.dataset.budgetPence);
      var spent = Number(form.dataset.spentPence);
      var threshold = Number(form.dataset.proposalThresholdPence);

      function gbp(pence) {
        return '£' + (pence / 100).toLocaleString('en-GB', {
          minimumFractionDigits: pence % 100 ? 2 : 0,
          maximumFractionDigits: 2,
        });
      }
      function pence(value) {
        var cleaned = value.replace(/[£,\\s]/g, '');
        if (!/^\\d+(\\.\\d{1,2})?$/.test(cleaned)) return null;
        var parts = cleaned.split('.');
        return Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
      }

      function money(amount) {
        return new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'GBP'}).format(amount / 100);
      }

      // Mirrors classifyPurchase (src/purchasing/classify-purchase.ts),
      // explanations included - the tests check they say the same. The server
      // works it out again from the same costs on the next page and on send.
      function listOf(names) {
        return names.length < 2
          ? names.join('')
          : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
      }
      function classify(consumable, amount, areaNames, risky) {
        var others = [];
        if (areaNames.length) {
          others.push('It affects ' + listOf(areaNames) +
            ' too, so it needs a proposal giving their owners a chance to give their input.');
        }
        if (risky) {
          others.push('It presents a moderate to high health and safety risk, so it needs a proposal with a risk assessment.');
        }
        function withOthers(sentence) {
          return [sentence].concat(others).join(' ');
        }
        if (consumable) {
          return {
            key: others.length ? 'consumable-proposal-needed' : 'consumable',
            reason: withOthers("Members pay for this, so it doesn't come out of the yearly budget."),
          };
        }
        if (amount >= threshold) {
          return {
            key: 'budget-proposal-needed',
            reason: withOthers('A single purchase of ' + money(threshold) + ' or more needs a proposal.'),
          };
        }
        var after = spent + amount;
        if (after > budget) {
          return {
            key: 'budget-proposal-needed',
            reason: withOthers("This would take this year's spending to " + money(after) +
              ', over the yearly budget of ' + money(budget) + ', so it needs a proposal.'),
          };
        }
        return {
          key: others.length ? 'budget-proposal-needed' : 'budget',
          reason: withOthers('This comes out of the yearly budget, leaving ' + money(budget - after) +
            ' of ' + money(budget) + ' for the rest of the year.'),
        };
      }

      // Which budget it comes out of, and whether it needs a proposal, once
      // there is a total and the consumable question is answered.
      // The list of other areas only matters once they say it affects some.
      var otherAreas = form.querySelector('[data-other-areas]');
      function showOtherAreas() {
        var affects = form.querySelector('input[name="affectsOtherAreas"]:checked');
        otherAreas.hidden = !(affects && affects.value === 'true');
      }

      function showVerdict(total) {
        showOtherAreas();
        var answer = form.querySelector('input[name="isMemberPaidConsumable"]:checked');
        if (!answer || !total) {
          verdict.hidden = true;
          verdict.innerHTML = '';
          return;
        }
        var affects = form.querySelector('input[name="affectsOtherAreas"]:checked');
        var areaNames = affects && affects.value === 'true'
          ? Array.prototype.map.call(
              form.querySelectorAll('input[name="affectedAreaIds"]:checked'),
              function (box) {
                return box.closest('label').querySelector('[data-area-name]').textContent.trim();
              }
            )
          : [];
        var risk = form.querySelector('input[name="healthAndSafetyRisk"]:checked');
        var result = classify(answer.value === 'true', total, areaNames, !!risk && risk.value === 'true');
        var template = form.querySelector('[data-verdict-template="' + result.key + '"]');
        verdict.innerHTML = template.innerHTML;
        verdict.querySelector('[data-verdict-total]').textContent = gbp(total);
        verdict.querySelector('[data-verdict-reason]').textContent = result.reason;
        verdict.hidden = false;
      }

      function field(item, name) {
        return item.querySelector('[name$="[' + name + ']"]').value.trim();
      }
      function hostname(url) {
        try {
          return new URL(/^[a-z]+:/i.test(url) ? url : 'https://' + url).hostname.replace(/^www[.]/, '');
        } catch (e) {
          return url;
        }
      }
      // A finished item - something saying what it is, a quantity and a
      // cost - folds down to one line so the whole order is easy to see.
      // Anything unfinished stays open, so nothing wrong is hidden.
      function isFinished(item) {
        return (field(item, 'url') || field(item, 'sku') || field(item, 'notes')) !== '' &&
          /^[0-9]+$/.test(field(item, 'quantity')) && Number(field(item, 'quantity')) > 0 &&
          pence(field(item, 'cost')) !== null;
      }
      function collapse(item) {
        if (!isFinished(item)) return;
        var summary = item.querySelector('[data-item-summary]');
        var name = field(item, 'sku') || hostname(field(item, 'url')) || field(item, 'notes');
        var parts = [name, 'Qty ' + field(item, 'quantity'), gbp(pence(field(item, 'cost')))];
        if (field(item, 'notes') && field(item, 'notes') !== name) parts.push(field(item, 'notes'));
        summary.textContent = '';
        var text = document.createElement('span');
        text.textContent = parts.join(' · ');
        var edit = document.createElement('span');
        edit.className = 'purchase-item__edit';
        edit.textContent = 'Edit';
        summary.appendChild(text);
        summary.appendChild(edit);
        summary.hidden = false;
        summary.setAttribute('aria-expanded', 'false');
        item.querySelector('[data-item-body]').hidden = true;
        item.classList.add('purchase-item--collapsed');
        item.dataset.added = 'true';
      }
      function expand(item) {
        // A new item is added; one already added is just finished with.
        item.querySelector('[data-item-done]').textContent =
          item.dataset.added ? 'Done' : 'Add item';
        item.querySelector('[data-item-message]').textContent = '';
        item.querySelector('[data-item-summary]').hidden = true;
        item.querySelector('[data-item-summary]').setAttribute('aria-expanded', 'true');
        item.querySelector('[data-item-body]').hidden = false;
        item.classList.remove('purchase-item--collapsed');
      }

      function isBlank(entry) {
        return Array.prototype.every.call(
          entry.querySelectorAll('input, textarea'),
          function (field) { return field.value.trim() === ''; }
        );
      }

      function shopSum(shop) {
        var sum = pence(shop.querySelector('[data-shop-delivery]').value) || 0;
        shop.querySelectorAll('[data-item-entry]').forEach(function (item) {
          sum += pence(item.querySelector('[data-item-cost]').value) || 0;
        });
        return sum;
      }

      // A shop folds the same way when another shop is being worked on: its
      // name and delivery become one line, and its items stay listed below,
      // each folded if finished. A shop with no name yet stays open.
      function collapseShop(shop) {
        var name = shop.querySelector('[name$="[shop]"]').value.trim();
        if (!name) return;
        shop.querySelectorAll('[data-item-entry]').forEach(collapse);
        var count = shop.querySelectorAll('[data-item-entry]').length;
        var delivery = pence(shop.querySelector('[data-shop-delivery]').value) || 0;
        var parts = [name, count + (count === 1 ? ' item' : ' items'), gbp(shopSum(shop))];
        if (delivery) parts.push('including ' + gbp(delivery) + ' delivery');
        var summary = shop.querySelector('[data-shop-summary]');
        summary.textContent = '';
        var text = document.createElement('strong');
        text.textContent = parts.join(' · ');
        var edit = document.createElement('span');
        edit.className = 'purchase-item__edit';
        edit.textContent = 'Edit';
        summary.appendChild(text);
        summary.appendChild(edit);
        summary.hidden = false;
        summary.setAttribute('aria-expanded', 'false');
        shop.querySelector('[data-shop-fields]').hidden = true;
        shop.querySelector('[data-add-item]').hidden = true;
        shop.classList.add('purchase-shop--collapsed');
      }
      function expandShop(shop) {
        shop.querySelector('[data-shop-summary]').hidden = true;
        shop.querySelector('[data-shop-summary]').setAttribute('aria-expanded', 'true');
        shop.querySelector('[data-shop-fields]').hidden = false;
        shop.querySelector('[data-add-item]').hidden = false;
        shop.classList.remove('purchase-shop--collapsed');
      }
      // Working on one shop folds the others.
      function focusShop(shop) {
        expandShop(shop);
        shops.querySelectorAll('[data-shop-entry]').forEach(function (other) {
          if (other !== shop) collapseShop(other);
        });
      }

      // Each shop's subtotal (its items' costs plus delivery) and the
      // request's total, which is what decides the budget.
      function update() {
        var total = 0;
        shops.querySelectorAll('[data-shop-entry]').forEach(function (shop) {
          var sum = shopSum(shop);
          shop.querySelector('[data-shop-total]').innerHTML =
            sum ? '<p>Shop total: ' + gbp(sum) + '</p>' : '';
          total += sum;
        });
        requestTotal.innerHTML = total ? '<p><strong>Total: ' + gbp(total) + '</strong></p>' : '';
        showVerdict(total);
      }

      // Names look like purchases[2][items][1][sku] and ids like
      // purchases-2-items-1-sku; these renumber a copied entry.
      function setShopIndex(entry, index) {
        entry.dataset.shopIndex = index;
        entry.querySelectorAll('[name]').forEach(function (field) {
          field.name = field.name.replace(/^purchases\\[\\d+\\]/, 'purchases[' + index + ']');
          field.id = field.id.replace(/^purchases-\\d+-/, 'purchases-' + index + '-');
        });
        entry.querySelectorAll('label[for]').forEach(function (label) {
          label.htmlFor = label.htmlFor.replace(/^purchases-\\d+-/, 'purchases-' + index + '-');
        });
      }
      function setItemIndex(entry, index) {
        entry.querySelectorAll('[name]').forEach(function (field) {
          field.name = field.name.replace(/\\[items\\]\\[\\d+\\]/, '[items][' + index + ']');
          field.id = field.id.replace(/-items-\\d+-/, '-items-' + index + '-');
        });
        entry.querySelectorAll('label[for]').forEach(function (label) {
          label.htmlFor = label.htmlFor.replace(/-items-\\d+-/, '-items-' + index + '-');
        });
      }
      function emptied(entry) {
        var copy = entry.cloneNode(true);
        copy.querySelectorAll('input, textarea').forEach(function (field) {
          field.value = '';
          field.textContent = '';
          field.required = false;
        });
        return copy;
      }

      function renumberItems(shop) {
        var items = shop.querySelectorAll('[data-item-entry]');
        items.forEach(function (item, index) {
          item.querySelector('[data-item-title]').textContent = 'Item ' + (index + 1);
          item.querySelector('[data-remove-item]').hidden = items.length < 2;
        });
      }
      function renumberShops() {
        var all = shops.querySelectorAll('[data-shop-entry]');
        all.forEach(function (shop, index) {
          shop.querySelector('[data-shop-title]').textContent = 'Shop ' + (index + 1);
          shop.querySelector('[data-remove-shop]').hidden = all.length < 2;
        });
      }

      // Item and shop indices only ever go up, so names stay unique after a
      // removal; blank ones are ignored when the form is read.
      function wireItem(shop, item) {
        item.querySelector('[data-remove-item]').addEventListener('click', function () {
          item.remove();
          renumberItems(shop);
          update();
        });
        // Clicking or tabbing onto the summary opens the item to edit.
        item.querySelector('[data-item-summary]').addEventListener('focus', function () {
          expand(item);
          item.querySelector('[data-item-body] input').focus();
        });
        item.querySelector('[data-item-summary]').addEventListener('click', function () {
          expand(item);
          item.querySelector('[data-item-body] input').focus();
        });
        // An item folds when it is added (or done with), not when focus
        // wanders off it. Until it's finished, say what it still needs.
        item.querySelector('[data-item-actions]').hidden = false;
        item.querySelector('[data-item-done]').addEventListener('click', function () {
          if (!isFinished(item)) {
            item.querySelector('[data-item-message]').textContent =
              'Give a link, SKU or notes, a whole-number quantity and a cost to add it.';
            return;
          }
          collapse(item);
          shop.querySelector('[data-add-item]').focus();
        });
        collapse(item);
        if (!item.dataset.added) expand(item);
      }
      function wireShop(shop) {
        var list = shop.querySelector('[data-item-entries]');
        var items = list.querySelectorAll('[data-item-entry]');
        var itemTemplate = emptied(items[0]);
        var nextItem = items.length;
        for (var i = 1; i < items.length; i++) {
          if (isBlank(items[i])) items[i].remove();
        }
        list.querySelectorAll('[data-item-entry]').forEach(function (item) {
          wireItem(shop, item);
        });
        shop.querySelector('[data-add-item]').addEventListener('click', function () {
          var item = itemTemplate.cloneNode(true);
          setItemIndex(item, nextItem++);
          list.appendChild(item);
          wireItem(shop, item);
          renumberItems(shop);
          item.querySelector('input').focus();
          update();
        });
        shop.querySelector('[data-remove-shop]').addEventListener('click', function () {
          shop.remove();
          renumberShops();
          update();
        });
        function openShop() {
          focusShop(shop);
          shop.querySelector('[name$="[shop]"]').focus();
        }
        shop.querySelector('[data-shop-summary]').addEventListener('focus', openShop);
        shop.querySelector('[data-shop-summary]').addEventListener('click', openShop);
        shop.addEventListener('focusin', function () {
          focusShop(shop);
        });
        renumberItems(shop);
      }

      var shopEntries = shops.querySelectorAll('[data-shop-entry]');
      var shopTemplate = emptied(shopEntries[0]);
      shopTemplate.querySelectorAll('[data-item-entry]').forEach(function (item, index) {
        if (index > 0) item.remove();
      });
      var nextShop = shopEntries.length;
      for (var j = 1; j < shopEntries.length; j++) {
        if (isBlank(shopEntries[j])) shopEntries[j].remove();
      }
      shops.querySelectorAll('[data-shop-entry]').forEach(wireShop);
      // Coming back to the page, every named shop starts folded.
      shops.querySelectorAll('[data-shop-entry]').forEach(collapseShop);
      form.querySelector('[data-add-shop]').addEventListener('click', function () {
        var shop = shopTemplate.cloneNode(true);
        setShopIndex(shop, nextShop++);
        shops.appendChild(shop);
        wireShop(shop);
        renumberShops();
        shop.querySelector('input').focus();
        update();
      });
      renumberShops();

      form.addEventListener('invalid', function (event) {
        var item = event.target.closest && event.target.closest('[data-item-entry]');
        if (item) expand(item);
        var shop = event.target.closest && event.target.closest('[data-shop-entry]');
        if (shop) expandShop(shop);
      }, true);
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      update();
    })();
  </script>
`;

const pages = [renderAboutPage, renderCostsPage, renderCheckPage];

const renderNoPurchasingAreas = () => html`
  <p>
    You aren't a purchaser for any purchasing area yet. Purchasers are chosen
    from area owners by the super users - ask one if you need to buy something
    for an area you look after.
  </p>
  <p><a href="/purchasing-areas">See the purchasing areas</a></p>
`;

export const renderSubmitForm = (viewModel: PurchaseRequestFormViewModel) =>
  html`
    <div class="purchase-request purchase-request__sections">
      <div class="purchase-request__stack">
        <h1>Request a purchase</h1>
        ${viewModel.step === 1
          ? html`<p>
              Answer a few questions and we'll tell you which budget your
              purchase comes out of, and whether you need to write a proposal.
            </p>`
          : html``}
      </div>
      ${viewModel.purchasingAreas.length === 0
        ? renderNoPurchasingAreas()
        : html`
            ${renderStepProgress({
              labels: PAGE_LABELS,
              current: viewModel.step,
              values: carried(viewModel),
              name: 'Purchase request progress',
            })}
            ${renderProblems(viewModel)} ${pages[viewModel.step - 1](viewModel)}
          `}
    </div>
  `;
