// The purchase request form, kept in this one file so the design can be
// swapped out wholesale. It is filled in a page at a time, like the Owners'
// Agreement, using the shared pieces in src/templates/multi-page-form.ts:
//
//   1. About the request: which purchasing area, a summary, why it's needed.
//   2. Budget and estimate: the area's budget as it stands, an estimated
//      total, and whether it is a consumable members pay for.
//   3. Cost breakdown: what the estimate means for the budget, then each shop
//      with its cost. The shop costs, not the estimate, decide the outcome.
//
// Pages 1 and 2 move on with a GET form carrying the answers so far; page 3
// posts everything to the submit command, which works out the outcome itself
// (src/purchasing/classify-purchase.ts). Which page to show, and what is still
// missing, is decided in submit-form.ts. Everything works without JavaScript;
// on page 3 a small script adds and removes shops and says what the shop
// costs add up to.
// Its styles are the `.purchase-request` rules in src/static/styles.css.

import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {Classification} from '../../purchasing/classify-purchase';
import {
  backHref,
  hiddenInputs,
  renderStepNav,
  renderStepProgress,
  StepValues,
} from '../../templates/multi-page-form';

export const PAGE_LABELS = [
  'About the request',
  'Budget and estimate',
  'Cost breakdown',
] as const;

export type PurchasingAreaOption = {
  id: UUID;
  name: string;
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
  estimatedAmount: string;
  isMemberPaidConsumable: string;
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
  // What they still need to answer, when they asked for a later page.
  missing: ReadonlyArray<string>;
  // Known from page 2 on.
  chosen: O.Option<PurchasingAreaOption>;
  // Known on page 3: the estimate, and what it would mean.
  estimate: O.Option<{amountPence: number; classification: Classification}>;
};

// Shop entries offered without JavaScript; blank ones are ignored.
const SHOP_ENTRIES = 3;

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

const renderShopEntry = (index: number) => {
  const required = index === 0 ? safe('required') : safe('');
  return html`
    <div class="purchase-shop" data-shop-entry>
      <div class="purchase-shop__head">
        <strong data-shop-title>Shop ${index + 1}</strong>
        <button
          class="purchase-request__link-button jsonly"
          type="button"
          data-remove-shop
          hidden
        >
          Remove
        </button>
      </div>
      <div class="purchase-shop__row">
        <div class="purchase-field">
          <label class="purchase-field__label" for="purchases-${index}-shop"
            >Shop or website</label
          >
          <input
            type="text"
            name="purchases[${index}][shop]"
            id="purchases-${index}-shop"
            placeholder="e.g. Axminster Tools"
            ${required}
          />
        </div>
        <div class="purchase-field">
          <label class="purchase-field__label" for="purchases-${index}-cost"
            >Cost</label
          >
          <div class="purchase-money">
            <span>£</span
            ><input
              type="text"
              inputmode="decimal"
              name="purchases[${index}][cost]"
              id="purchases-${index}-cost"
              placeholder="0.00"
              data-shop-cost
              ${required}
            />
          </div>
        </div>
      </div>
      <div class="purchase-field">
        <label class="purchase-field__label" for="purchases-${index}-link"
          >Link
          <span class="purchase-request__hint purchase-request__normal"
            >(optional)</span
          ></label
        >
        <input
          type="text"
          inputmode="url"
          name="purchases[${index}][link]"
          id="purchases-${index}-link"
          placeholder="https://"
        />
      </div>
      <div class="purchase-field">
        <label class="purchase-field__label" for="purchases-${index}-items"
          >What you're buying here</label
        >
        <span class="purchase-request__hint text-sm"
          >List each item with its quantity.</span
        >
        <textarea
          name="purchases[${index}][items]"
          id="purchases-${index}-items"
          ${required}
        ></textarea>
      </div>
    </div>
  `;
};

// Every answer so far, in page order, to carry to another page.
const carried = ({requestId, answers}: PurchaseRequestFormViewModel) =>
  (
    [
      ['id', requestId],
      ['purchasingAreaId', answers.purchasingAreaId],
      ['summary', answers.summary],
      ['justification', answers.justification],
      ['estimatedAmount', answers.estimatedAmount],
      ['isMemberPaidConsumable', answers.isMemberPaidConsumable],
    ] as const
  ).filter(([, value]) => value !== '');

// Everything but the named fields, which the page itself asks for.
const carriedExcept = (
  viewModel: PurchaseRequestFormViewModel,
  names: ReadonlyArray<string>
): StepValues => carried(viewModel).filter(([name]) => !names.includes(name));

const checkedIf = (condition: boolean) => (condition ? safe('checked') : '');

const renderMissing = ({missing}: PurchaseRequestFormViewModel) =>
  missing.length > 0
    ? html`<div class="callout callout--red" role="alert">
        <p>
          Please give ${sanitizeString(missing.join(', '))} before moving on.
        </p>
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
      carriedExcept(viewModel, ['purchasingAreaId', 'summary', 'justification'])
    )}
    <fieldset class="purchase-request__fieldset">
      <legend>Which area is this for?</legend>
      <p class="purchase-request__hint text-sm">
        You can request purchases for areas you own.
      </p>
      <div class="purchase-request__radios">
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

const renderBudgetPage = (viewModel: PurchaseRequestFormViewModel) => html`
  <form method="get" class="purchase-request__sections">
    <input type="hidden" name="step" value="3" />
    ${hiddenInputs(
      carriedExcept(viewModel, ['estimatedAmount', 'isMemberPaidConsumable'])
    )}
    ${pipe(
      viewModel.chosen,
      O.match(() => html``, renderBudget(viewModel.budgetYear))
    )}
    <div class="purchase-field">
      <label class="purchase-field__label" for="estimatedAmount"
        >How much will it cost in total?</label
      >
      <span class="purchase-request__hint text-sm"
        >Your best estimate, including VAT and delivery. You'll break it down
        on the next page.</span
      >
      <div class="purchase-money purchase-money--narrow">
        <span>£</span
        ><input
          type="text"
          inputmode="decimal"
          name="estimatedAmount"
          id="estimatedAmount"
          placeholder="0.00"
          value="${sanitizeString(viewModel.answers.estimatedAmount)}"
          required
        />
      </div>
    </div>
    <fieldset class="purchase-request__fieldset purchase-question">
      <legend>Is it a consumable that members pay for when they use it?</legend>
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
    ${renderNext(viewModel)}
  </form>
`;

const verdictStyle = {
  consumable: {
    modifier: 'consumable',
    tag: html`<span class="tag tag--green">Consumable</span>`,
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
} as const;

// What the estimate means, in the classifier's own words, and how much the
// shops can come to before a proposal is needed.
const renderEstimateVerdict = (
  viewModel: PurchaseRequestFormViewModel,
  amountPence: number,
  classification: Classification
) => {
  const style = verdictStyle[classification.outcome];
  const limit = pipe(
    viewModel.chosen,
    O.match(
      () => html``,
      area =>
        classification.outcome === 'consumable'
          ? html``
          : area.remainingPence < viewModel.proposalThresholdPence
            ? html`<p>
                What counts is what the shops below add up to. Up to
                ${gbp(Math.max(area.remainingPence, 0))} needs no proposal.
              </p>`
            : html`<p>
                What counts is what the shops below add up to. Under
                ${gbp(viewModel.proposalThresholdPence)} needs no proposal.
              </p>`
    )
  );
  return html`
    <div
      class="purchase-verdict purchase-verdict--${safe(style.modifier)}"
      data-estimate-verdict
    >
      <span class="purchase-request__hint text-sm"
        >Based on your ${gbp(amountPence)} estimate</span
      >
      <span>${style.tag}</span>
      <h2>${safe(style.heading)}</h2>
      <p>${sanitizeString(classification.reason)}</p>
      ${limit}
    </div>
  `;
};

const renderCostsPage = (viewModel: PurchaseRequestFormViewModel) => {
  const estimatePence = pipe(
    viewModel.estimate,
    O.match(
      () => 0,
      ({amountPence}) => amountPence
    )
  );
  const remainingPence = pipe(
    viewModel.chosen,
    O.match(
      () => 0,
      area => area.remainingPence
    )
  );
  return html`
    ${pipe(
      viewModel.estimate,
      O.match(
        () => html``,
        ({amountPence, classification}) =>
          renderEstimateVerdict(viewModel, amountPence, classification)
      )
    )}
    <form
      id="purchase-request-form"
      class="purchase-request__sections"
      action="/purchase-requests/submit?next=${safe(
        encodeURIComponent(
          `/purchase-requests/view/${viewModel.requestId}?sent=1`
        )
      )}"
      method="post"
      data-estimate-pence="${estimatePence}"
      data-remaining-pence="${remainingPence}"
      data-proposal-threshold-pence="${viewModel.proposalThresholdPence}"
      data-consumable="${sanitizeString(
        viewModel.answers.isMemberPaidConsumable
      )}"
    >
      ${hiddenInputs(carried(viewModel))}
      <div class="purchase-request__stack">
        <h2>What are you buying, and where from?</h2>
        <p class="purchase-request__hint text-sm">
          Add one entry for each shop or website. If everything comes from one
          place, you only need one.
        </p>
        <div class="purchase-request__stack" data-shop-entries>
          ${joinHtml(
            Array.from({length: SHOP_ENTRIES}, (_, index) =>
              renderShopEntry(index)
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
        <div data-shop-total aria-live="polite"></div>
      </div>
      ${renderStepNav({
        back: backHref(viewModel.step, carried(viewModel)),
        next: html`<button type="submit">Send request</button>`,
      })}
    </form>
    ${enhancementScript}
  `;
};

// Plain browser JavaScript for page 3, kept free of template substitutions
// (so no backtick strings in it) and of single backslashes.
const enhancementScript = html`
  <script>
    (function () {
      var form = document.getElementById('purchase-request-form');
      if (!form) return;
      var estimate = Number(form.dataset.estimatePence);
      var remaining = Number(form.dataset.remainingPence);
      var threshold = Number(form.dataset.proposalThresholdPence);
      var consumable = form.dataset.consumable === 'true';
      var shops = form.querySelector('[data-shop-entries]');
      var total = form.querySelector('[data-shop-total]');

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

      // What the shop costs add up to, and what that means. The server works
      // the outcome out again from the same costs when the form is sent.
      function update() {
        var sum = 0;
        form.querySelectorAll('[data-shop-cost]').forEach(function (field) {
          var cost = pence(field.value);
          if (cost !== null) sum += cost;
        });
        if (!sum) {
          total.innerHTML = '';
          return;
        }
        var text = sum === estimate
          ? 'These add up to <strong>' + gbp(sum) + '</strong>, the same as your estimate.'
          : '<span class="tag tag--yellow">Note</span> These add up to <strong>' + gbp(sum) + '</strong>, ' +
            (sum > estimate ? 'more' : 'less') + ' than your ' + gbp(estimate) + ' estimate. ' +
            'The shop total is what counts.';
        if (!consumable) {
          var needsProposal = sum >= threshold || sum > remaining;
          text += needsProposal
            ? ' <strong>At this total you will need to write a proposal.</strong>'
            : ' At this total it comes out of your yearly budget with no proposal needed.';
        }
        total.innerHTML = '<p class="text-sm">' + text + '</p>';
      }

      // Shop entries: start with one, add or remove on request. Field
      // indices only ever go up, so names stay unique after a removal.
      var entries = shops.querySelectorAll('[data-shop-entry]');
      var template = entries[0].cloneNode(true);
      for (var i = 1; i < entries.length; i++) entries[i].remove();
      var nextIndex = entries.length;
      function renumber() {
        var all = shops.querySelectorAll('[data-shop-entry]');
        all.forEach(function (entry, index) {
          entry.querySelector('[data-shop-title]').textContent = all.length > 1 ? 'Shop ' + (index + 1) : 'Where from';
          entry.querySelector('[data-remove-shop]').hidden = all.length < 2;
        });
      }
      function wireRemove(entry) {
        entry.querySelector('[data-remove-shop]').addEventListener('click', function () {
          entry.remove();
          renumber();
          update();
        });
      }
      wireRemove(entries[0]);
      form.querySelector('[data-add-shop]').addEventListener('click', function () {
        var index = nextIndex++;
        var entry = template.cloneNode(true);
        entry.querySelectorAll('[name]').forEach(function (field) {
          field.name = field.name.replace(/\\[\\d+\\]/, '[' + index + ']');
          field.id = field.id.replace(/-\\d+-/, '-' + index + '-');
          field.value = '';
        });
        entry.querySelectorAll('label[for]').forEach(function (label) {
          label.htmlFor = label.htmlFor.replace(/-\\d+-/, '-' + index + '-');
        });
        wireRemove(entry);
        shops.appendChild(entry);
        renumber();
        entry.querySelector('input').focus();
        update();
      });
      renumber();

      form.addEventListener('input', update);
      update();
    })();
  </script>
`;

const pages = [renderAboutPage, renderBudgetPage, renderCostsPage];

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
            ${renderMissing(viewModel)} ${pages[viewModel.step - 1](viewModel)}
          `}
    </div>
  `;
