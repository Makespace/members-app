// The purchase request form, kept in this one file so the design can be
// swapped out wholesale. It follows the purchase-request prototype: give a
// summary, pick the purchasing area, see its budget, give an estimated total,
// say whether it is a consumable, see the verdict, then say what is being
// bought and from where.
// It only needs the view model below; everything it shows comes from there.
// Its styles are the `.purchase-request` rules in src/static/styles.css.
//
// It works without JavaScript: every section is shown, each purchasing area's
// budget is listed, three shop entries are offered (blank ones are ignored)
// and the server works out the outcome on submit. The inline script at the
// bottom is a progressive enhancement that reveals sections as the questions
// are answered, shows the chosen area's budget as it stands, keeps the
// verdict up to date, adds and removes shop entries and compares the shop
// costs with the estimate. The
// server is always authoritative - see src/purchasing/classify-purchase.ts.

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';

export type PurchaseRequestFormViewModel = {
  requestId: UUID;
  budgetYear: number;
  // Only the purchasing areas this member may submit for.
  purchasingAreas: ReadonlyArray<{
    id: UUID;
    name: string;
    areaNames: ReadonlyArray<string>;
    yearlyBudgetPence: number;
    spentThisYearPence: number;
    remainingPence: number;
  }>;
  preselected: O.Option<UUID>;
  // A single budget purchase of this much or more needs a proposal.
  proposalThresholdPence: number;
};

type PurchasingAreaOption =
  PurchaseRequestFormViewModel['purchasingAreas'][number];

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

const isSelected = (
  viewModel: PurchaseRequestFormViewModel,
  purchasingArea: PurchasingAreaOption
) =>
  viewModel.purchasingAreas.length === 1 ||
  (O.isSome(viewModel.preselected) &&
    viewModel.preselected.value === purchasingArea.id);

const renderAreaRadio =
  (viewModel: PurchaseRequestFormViewModel) =>
  (purchasingArea: PurchasingAreaOption) => html`
    <div class="fieldset-item">
      <input
        type="radio"
        name="purchasingAreaId"
        id="area-${purchasingArea.id}"
        value="${purchasingArea.id}"
        data-budget-pence="${purchasingArea.yearlyBudgetPence}"
        data-spent-pence="${purchasingArea.spentThisYearPence}"
        required
        ${isSelected(viewModel, purchasingArea) ? safe('checked') : safe('')}
      />
      <label for="area-${purchasingArea.id}">
        <span data-area-name>${sanitizeString(purchasingArea.name)}</span>
        ${purchasingArea.areaNames.length > 1
          ? html`<span class="purchase-request__hint text-sm"
              >Shared budget:
              ${sanitizeString(purchasingArea.areaNames.join(' and '))}</span
            >`
          : html``}
      </label>
    </div>
  `;

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

// Plain browser JavaScript, kept free of template substitutions (so no
// backtick strings in it) and of single backslashes.
const enhancementScript = html`
  <script>
    (function () {
      var form = document.getElementById('purchase-request-form');
      if (!form) return;
      var threshold = Number(form.dataset.proposalThresholdPence);
      var year = form.dataset.budgetYear;
      var verdict = form.querySelector('[data-verdict]');
      var question = form.querySelector('[data-consumable-question]');
      var submitSection = form.querySelector('[data-submit-section]');
      var shops = form.querySelector('[data-shop-entries]');
      var total = form.querySelector('[data-shop-total]');
      var justificationHint = form.querySelector('[data-justification-hint]');
      var budgets = form.querySelectorAll('[data-budget-for]');

      function esc(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
          return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
        });
      }
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
      function checked(name) {
        return form.querySelector('input[name="' + name + '"]:checked');
      }
      function selectedArea() {
        var radio = checked('purchasingAreaId');
        if (!radio) return null;
        var label = form.querySelector('label[for="' + radio.id + '"] [data-area-name]');
        return {
          id: radio.value,
          name: label ? label.textContent.trim() : '',
          budget: Number(radio.dataset.budgetPence),
          spent: Number(radio.dataset.spentPence),
        };
      }

      // Mirrors classifyPurchase on the server, which has the final say.
      function classify(consumable, amount, area) {
        if (consumable === 'true') return {key: 'consumable'};
        if (consumable !== 'false') return null;
        if (amount >= threshold) return {key: 'proposal', reason: 'single'};
        if (!area) return {key: 'budget'};
        if (area.spent + amount > area.budget) return {key: 'proposal', reason: 'over'};
        return {key: 'budget'};
      }

      function renderVerdict(r, area, amount) {
        var after = area ? area.spent + amount : 0;
        var remaining = area ? area.budget - area.spent : 0;
        if (r.key === 'consumable') {
          return '<div class="purchase-verdict purchase-verdict--consumable">' +
            '<span><span class="tag tag--green">Consumable</span></span>' +
            '<h2>This doesn' + "'" + 't come out of your yearly budget</h2>' +
            '<p>Members pay for consumables when they use them, so the cost comes back to Makespace. ' +
            'Make sure the price on SumUp covers what you' + "'" + 're buying.</p></div>';
        }
        if (!amount) {
          return '<div class="purchase-verdict purchase-verdict--budget">' +
            '<span><span class="tag tag--grey">Yearly budget</span></span>' +
            '<h2>This comes out of your yearly budget</h2>' +
            '<p>Enter how much it will cost above to see whether you' + "'" + 'll need a proposal.</p></div>';
        }
        if (r.key === 'budget' && !area) {
          return '<div class="purchase-verdict purchase-verdict--budget">' +
            '<span><span class="tag tag--grey">Yearly budget</span></span>' +
            '<h2>This comes out of your yearly budget</h2>' +
            '<p>Choose which area this is for to see whether you' + "'" + 'll need a proposal.</p></div>';
        }
        if (r.key === 'budget') {
          return '<div class="purchase-verdict purchase-verdict--budget">' +
            '<span><span class="tag tag--yellow">Yearly budget</span></span>' +
            '<h2>This comes out of your yearly budget. No proposal needed.</h2>' +
            '<p>It will take ' + esc(area.name) + ' from ' + gbp(area.spent) + ' to <strong>' + gbp(after) +
            '</strong> of its ' + gbp(area.budget) + ' budget, leaving ' + gbp(area.budget - after) +
            ' for the rest of ' + esc(year) + '.</p></div>';
        }
        var why = r.reason === 'single'
          ? '<li>It costs ' + gbp(amount) + '. Any single purchase of ' + gbp(threshold) + ' or more needs a proposal.</li>'
          : '<li>It would take ' + esc(area.name) + ' to ' + gbp(after) + ', which is ' + gbp(after - area.budget) +
            ' over its ' + gbp(area.budget) + ' budget. You have ' + gbp(Math.max(remaining, 0)) +
            ' left this year without a proposal.</li>';
        return '<div class="purchase-verdict purchase-verdict--proposal">' +
          '<span><span class="tag tag--red">Yearly budget · Proposal needed</span></span>' +
          '<h2>You' + "'" + 'll need to write a proposal</h2><ul>' + why + '</ul>' +
          '<p>You can still send this request so it' + "'" + 's on record. Nothing will be bought until the proposal is agreed.</p></div>';
      }

      function renderTotal(amount) {
        var sum = 0;
        form.querySelectorAll('[data-shop-cost]').forEach(function (field) {
          var cost = pence(field.value);
          if (cost !== null) sum += cost;
        });
        if (!sum) return '';
        if (sum === amount) {
          return '<span class="tag tag--green">Matches</span> Total ' + gbp(sum) + ', the same as your estimate.';
        }
        return '<span class="tag tag--yellow">Check</span> These add up to ' + gbp(sum) + ', but your estimate above is ' +
          gbp(amount) + '. Update the estimate if the total has changed, because it affects which budget this comes from.';
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

      function update() {
        var area = selectedArea();
        var amount = Math.max(pence(form.elements.estimatedAmount.value) || 0, 0);
        var consumableRadio = checked('isMemberPaidConsumable');
        var consumable = consumableRadio ? consumableRadio.value : null;
        question.classList.toggle('purchase-question--answered', !!consumable);
        // Answering the question is enough to move on; without an area the
        // verdict asks for one rather than holding the rest of the form back.
        var r = classify(consumable, amount, area);

        // The budget panel shows where the area stands now; the verdict
        // explains what this purchase would do to it.
        budgets.forEach(function (budget) {
          budget.hidden = !area || budget.dataset.budgetFor !== area.id;
        });

        var key = r ? [r.key, r.reason || '', area ? area.id : '', amount].join('|') : '';
        if (verdict.dataset.key !== key) {
          verdict.dataset.key = key;
          verdict.hidden = !r;
          verdict.innerHTML = r ? renderVerdict(r, area, amount) : '';
        }
        submitSection.hidden = !r;
        total.innerHTML = r ? renderTotal(amount) : '';
        justificationHint.textContent = r && r.key === 'proposal'
          ? 'A short summary. You will write the full case in your proposal.'
          : 'A sentence or two for the people who sign off spending.';
      }

      form.addEventListener('input', update);
      form.addEventListener('change', update);
      update();
    })();
  </script>
`;

const renderForm = (viewModel: PurchaseRequestFormViewModel) => html`
  <form
    id="purchase-request-form"
    class="purchase-request__sections"
    action="/purchase-requests/submit?next=${safe(
      encodeURIComponent(`/purchase-requests/view/${viewModel.requestId}?sent=1`)
    )}"
    method="post"
    data-proposal-threshold-pence="${viewModel.proposalThresholdPence}"
    data-budget-year="${viewModel.budgetYear}"
  >
    <input type="hidden" name="id" value="${viewModel.requestId}" />

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
        required
      />
    </div>

    <fieldset class="purchase-request__fieldset">
      <legend>Which area is this for?</legend>
      <p class="purchase-request__hint text-sm">
        You can request purchases for areas you own.
      </p>
      <div class="purchase-request__radios">
        ${joinHtml(viewModel.purchasingAreas.map(renderAreaRadio(viewModel)))}
      </div>
    </fieldset>

    <div class="purchase-request__budgets">
      ${joinHtml(
        viewModel.purchasingAreas.map(renderBudget(viewModel.budgetYear))
      )}
    </div>

    <div class="purchase-field">
      <label class="purchase-field__label" for="estimatedAmount"
        >How much will it cost in total?</label
      >
      <span class="purchase-request__hint text-sm"
        >Your best estimate, including VAT and delivery. You'll give the details
        later.</span
      >
      <div class="purchase-money purchase-money--narrow">
        <span>£</span
        ><input
          type="text"
          inputmode="decimal"
          name="estimatedAmount"
          id="estimatedAmount"
          placeholder="0.00"
          required
        />
      </div>
    </div>

    <div class="purchase-request__stack">
      <h2>Which budget does it come from?</h2>
      <fieldset
        class="purchase-request__fieldset purchase-question"
        data-consumable-question
      >
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
            />
            <label for="consumable-no">No</label>
          </div>
        </div>
      </fieldset>
      <div data-verdict hidden aria-live="polite"></div>
    </div>

    <div class="purchase-request__sections" data-submit-section>
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
        <div class="text-sm" data-shop-total aria-live="polite"></div>
      </div>
      <div class="purchase-field">
        <label class="purchase-field__label" for="justification"
          >Why is this needed?</label
        >
        <span class="purchase-request__hint text-sm" data-justification-hint
          >A sentence or two for the people who sign off spending.</span
        >
        <textarea name="justification" id="justification" required></textarea>
      </div>
      <button class="purchase-request__send" type="submit">Send request</button>
    </div>
  </form>
  ${enhancementScript}
`;

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
        <p>
          Answer a few questions and we'll tell you which budget your purchase
          comes out of, and whether you need to write a proposal.
        </p>
      </div>
      ${viewModel.purchasingAreas.length === 0
        ? renderNoPurchasingAreas()
        : renderForm(viewModel)}
    </div>
  `;
