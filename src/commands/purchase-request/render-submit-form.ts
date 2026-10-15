// The purchase request form, kept in this one file so the design can be
// swapped out wholesale (it is being iterated on separately via a prototype).
// It only needs the view model below; everything it shows comes from there.
//
// The form asks for the purchasing area and an estimated total first, then
// the three classification questions (which run on that estimate), then the
// specifics: a short summary, one entry per shop or website, and why it is
// needed.
//
// It works without JavaScript: all three questions are shown, a fixed number
// of shop entries are offered (blank ones are ignored), and the server works
// out the outcome on submit. The small inline script at the bottom is a
// progressive enhancement that hides questions that no longer matter,
// previews the likely outcome, adds shop entries on request and points out
// when the shop costs don't add up to the estimate. The server is always
// authoritative - see src/purchasing/classify-purchase.ts.

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';

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
  // A single CapEx purchase of this much or more needs a proposal.
  proposalThresholdPence: number;
  // Operations spending of more than this needs the directors' approval.
  directorsApprovalThresholdPence: number;
};

type PurchasingAreaOption =
  PurchaseRequestFormViewModel['purchasingAreas'][number];

// Shop entries offered without JavaScript; blank ones are ignored.
const SHOP_ENTRIES = 3;

const pounds = (pence: number) =>
  sanitizeString(
    (pence / 100).toLocaleString('en-GB', {style: 'currency', currency: 'GBP'})
  );

const renderBudgetRow = (purchasingArea: PurchasingAreaOption) => html`
  <tr>
    <td>
      <a href="/purchasing-areas/${purchasingArea.id}"
        >${sanitizeString(purchasingArea.name)}</a
      >
      ${purchasingArea.areaNames.length > 0
        ? html`<br /><small
              >${sanitizeString(purchasingArea.areaNames.join(', '))}</small
            >`
        : html``}
    </td>
    <td>${pounds(purchasingArea.yearlyBudgetPence)}</td>
    <td>${pounds(purchasingArea.spentThisYearPence)}</td>
    <td>${pounds(purchasingArea.remainingPence)}</td>
  </tr>
`;

const renderBudgets = (viewModel: PurchaseRequestFormViewModel) => html`
  <section class="stack">
    <h2>Budgets for ${viewModel.budgetYear}</h2>
    <table>
      <thead>
        <tr>
          <th>Purchasing area</th>
          <th>Yearly budget</th>
          <th>CapEx so far</th>
          <th>Remaining</th>
        </tr>
      </thead>
      <tbody>
        ${joinHtml(viewModel.purchasingAreas.map(renderBudgetRow))}
      </tbody>
    </table>
    <p>
      <small
        >Only CapEx comes out of the budget. Consumables, running costs and
        anything under £100 a year (OpEx) are recorded but don't count against
        it.</small
      >
    </p>
  </section>
`;

const renderPurchasingAreaOption =
  (preselected: O.Option<UUID>) => (purchasingArea: PurchasingAreaOption) =>
    html`<option
      value="${purchasingArea.id}"
      data-budget-pence="${purchasingArea.yearlyBudgetPence}"
      data-spent-pence="${purchasingArea.spentThisYearPence}"
      ${O.isSome(preselected) && preselected.value === purchasingArea.id
        ? safe('selected')
        : safe('')}
    >
      ${sanitizeString(purchasingArea.name)}
    </option>`;

const renderPurchasingAreaPicker = (viewModel: PurchaseRequestFormViewModel) =>
  viewModel.purchasingAreas.length === 1
    ? html`
        <p>
          For <b>${sanitizeString(viewModel.purchasingAreas[0].name)}</b>
        </p>
        <select name="purchasingAreaId" id="purchasingAreaId" hidden>
          ${renderPurchasingAreaOption(O.some(viewModel.purchasingAreas[0].id))(
            viewModel.purchasingAreas[0]
          )}
        </select>
      `
    : html`
        <label for="purchasingAreaId">Which purchasing area is it for?</label>
        <select name="purchasingAreaId" id="purchasingAreaId" required>
          ${O.isNone(viewModel.preselected)
            ? html`<option value="" selected disabled>Choose one</option>`
            : html``}
          ${joinHtml(
            viewModel.purchasingAreas.map(
              renderPurchasingAreaOption(viewModel.preselected)
            )
          )}
        </select>
      `;

const yesNo = (
  name: string,
  legend: Html,
  hint: Html,
  required: boolean
) => html`
  <fieldset data-question="${safe(name)}">
    <legend>${legend}</legend>
    <p><small>${hint}</small></p>
    <div class="fieldset-item">
      <input
        type="radio"
        id="${safe(name)}-yes"
        name="${safe(name)}"
        value="true"
        ${required ? safe('required') : safe('')}
      />
      <label for="${safe(name)}-yes"><span>Yes</span></label>
    </div>
    <div class="fieldset-item">
      <input
        type="radio"
        id="${safe(name)}-no"
        name="${safe(name)}"
        value="false"
        ${required ? safe('required') : safe('')}
      />
      <label for="${safe(name)}-no"><span>No</span></label>
    </div>
  </fieldset>
`;

const renderShopEntry = (index: number) => {
  const required = index === 0 ? safe('required') : safe('');
  return html`
    <fieldset class="stack purchase-request__shop" data-shop-entry>
      <legend>
        Shop ${index + 1}${index === 0 ? html`` : html` (optional)`}
      </legend>
      <label for="purchases-${index}-shop">Shop or website</label>
      <input
        type="text"
        name="purchases[${index}][shop]"
        id="purchases-${index}-shop"
        ${required}
      />
      <label for="purchases-${index}-link">Link (optional)</label>
      <input
        type="text"
        inputmode="url"
        name="purchases[${index}][link]"
        id="purchases-${index}-link"
      />
      <label for="purchases-${index}-items">Items and quantities</label>
      <textarea
        name="purchases[${index}][items]"
        id="purchases-${index}-items"
        rows="3"
        placeholder="e.g. 2 x 1kg PLA filament (black)"
        ${required}
      ></textarea>
      <label for="purchases-${index}-cost"
        >Cost from this shop (£, optional)</label
      >
      <input
        type="text"
        inputmode="decimal"
        name="purchases[${index}][cost]"
        id="purchases-${index}-cost"
        data-shop-cost
      />
    </fieldset>
  `;
};

// Plain browser JavaScript, kept free of template substitutions.
const enhancementScript = html`
  <script>
    (function () {
      var form = document.getElementById('purchase-request-form');
      if (!form) return;
      var threshold = Number(form.dataset.proposalThresholdPence);
      var directorsThreshold = Number(form.dataset.directorsApprovalThresholdPence);
      var preview = form.querySelector('[data-outcome-preview]');
      var costCheck = form.querySelector('[data-cost-check]');
      var shopEntries = form.querySelector('[data-shop-entries]');
      var questions = {
        isOperations: form.querySelector('[data-question="isOperations"]'),
        under100PerYear: form.querySelector('[data-question="under100PerYear"]'),
      };
      form.querySelectorAll('.purchase-request__no-js-hint').forEach(function (hint) {
        hint.style.display = 'none';
      });

      // With JavaScript, start with one shop and add more on request.
      var entries = shopEntries.querySelectorAll('[data-shop-entry]');
      var template = entries[entries.length - 1].cloneNode(true);
      for (var i = 1; i < entries.length; i++) entries[i].remove();
      var nextIndex = 1;
      form.querySelector('[data-add-shop]').addEventListener('click', function () {
        var index = nextIndex++;
        var entry = template.cloneNode(true);
        entry.querySelector('legend').textContent = 'Shop ' + (index + 1) + ' (optional)';
        entry.querySelectorAll('[name]').forEach(function (field) {
          field.name = field.name.replace(/\\[\\d+\\]/, '[' + index + ']');
          field.id = field.id.replace(/-\\d+-/, '-' + index + '-');
          field.value = '';
        });
        entry.querySelectorAll('label[for]').forEach(function (label) {
          label.htmlFor = label.htmlFor.replace(/-\\d+-/, '-' + index + '-');
        });
        shopEntries.appendChild(entry);
        entry.querySelector('input').focus();
      });

      function answer(name) {
        var checked = form.querySelector('input[name="' + name + '"]:checked');
        return checked ? checked.value === 'true' : null;
      }
      function show(name, visible) {
        questions[name].style.display = visible ? '' : 'none';
        if (!visible) {
          form.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
            input.checked = false;
          });
        }
      }
      function pence(value) {
        var cleaned = value.replace(/[£,\\s]/g, '');
        if (!/^\\d+(\\.\\d{1,2})?$/.test(cleaned)) return null;
        var parts = cleaned.split('.');
        return Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
      }
      function money(amount) {
        return (amount / 100).toLocaleString('en-GB', {style: 'currency', currency: 'GBP'});
      }
      function selectedBudget() {
        var select = form.elements.purchasingAreaId;
        var option = select.options[select.selectedIndex];
        if (!option || !option.value) return null;
        return {
          budget: Number(option.dataset.budgetPence),
          spent: Number(option.dataset.spentPence),
        };
      }
      function outcome() {
        var consumable = answer('isMemberPaidConsumable');
        var operations = answer('isOperations');
        var lowCost = answer('under100PerYear');
        if (consumable === null) return '';
        if (consumable) return 'OpEx (a consumable) - it will not come out of the budget.';
        if (operations === null) return '';
        if (operations) {
          var estimate = pence(form.elements.estimatedAmount.value);
          if (estimate === null) return "OpEx (operations) - it will not come out of the budget. Over " + money(directorsThreshold) + " it needs the directors' approval.";
          if (estimate > directorsThreshold) return "OpEx (operations) - it will not come out of the budget, but at over " + money(directorsThreshold) + " it needs the directors' approval.";
          return 'OpEx (operations) - it will not come out of the budget.';
        }
        if (lowCost === null) return '';
        if (lowCost) return 'OpEx (under £100 a year) - it will not come out of the budget.';
        var amount = pence(form.elements.estimatedAmount.value);
        if (amount === null) return 'CapEx - enter the estimated total to see whether it needs a proposal.';
        if (amount >= threshold) return 'CapEx - a single purchase of ' + money(threshold) + ' or more needs a proposal.';
        var figures = selectedBudget();
        if (figures === null) return 'CapEx - choose the purchasing area to check it against the budget.';
        var after = figures.spent + amount;
        if (after > figures.budget) {
          return 'CapEx - this would take this year to ' + money(after) + ', over the ' + money(figures.budget) + ' budget, so it needs a proposal.';
        }
        return 'CapEx from the yearly budget, leaving ' + money(figures.budget - after) + '.';
      }
      // Shop costs are optional and need not match the estimate; a mismatch
      // is pointed out, not refused.
      function costMismatch() {
        var estimate = pence(form.elements.estimatedAmount.value);
        var total = 0;
        var any = false;
        form.querySelectorAll('[data-shop-cost]').forEach(function (field) {
          var cost = pence(field.value);
          if (cost !== null) { total += cost; any = true; }
        });
        if (!any || estimate === null || total === estimate) return '';
        return 'The shop costs add up to ' + money(total) + ', but the estimate is ' + money(estimate) + '. The estimate is what counts against the budget.';
      }
      function update() {
        var consumable = answer('isMemberPaidConsumable');
        show('isOperations', consumable === false);
        show('under100PerYear', consumable === false && answer('isOperations') === false);
        var text = outcome();
        preview.textContent = text ? 'Likely outcome: ' + text + ' (confirmed when you submit)' : '';
        preview.hidden = !text;
        var mismatch = costMismatch();
        costCheck.textContent = mismatch;
        costCheck.hidden = !mismatch;
      }
      form.addEventListener('change', update);
      form.addEventListener('input', update);
      update();
    })();
  </script>
`;

const renderForm = (viewModel: PurchaseRequestFormViewModel) => html`
  <form
    id="purchase-request-form"
    class="stack"
    action="/purchase-requests/submit?next=${safe(
      encodeURIComponent(`/purchase-requests/view/${viewModel.requestId}`)
    )}"
    method="post"
    data-proposal-threshold-pence="${viewModel.proposalThresholdPence}"
    data-directors-approval-threshold-pence="${viewModel.directorsApprovalThresholdPence}"
  >
    <input type="hidden" name="id" value="${viewModel.requestId}" />
    ${renderPurchasingAreaPicker(viewModel)}

    <label for="estimatedAmount"
      >Estimated total cost, including VAT and delivery (£)</label
    >
    <input
      type="text"
      inputmode="decimal"
      name="estimatedAmount"
      id="estimatedAmount"
      placeholder="e.g. 630.00"
      required
    />

    <h2>Which kind of spending is it?</h2>
    ${yesNo(
      'isMemberPaidConsumable',
      html`Is it a consumable you expect members to pay for at point of use?`,
      html`For example 3D printer filament paid for via SumUp.`,
      true
    )}
    ${yesNo(
      'isOperations',
      html`Is it maintenance, a running cost, or a like-for-like replacement
      needed to keep things running safely?`,
      html`For example fixing the planer-thicknesser (£630), a technician's
        yearly fee, or replacing something at the end of its life.
        <span class="purchase-request__no-js-hint"
          >Skip this if you answered yes above.</span
        >`,
      false
    )}
    ${yesNo(
      'under100PerYear',
      html`Will it cost under £100 a year, by your estimate?`,
      html`For example embroidery thread.
        <span class="purchase-request__no-js-hint"
          >Skip this if you answered yes to either question above.</span
        >`,
      false
    )}

    <p class="jsonly" data-outcome-preview aria-live="polite" hidden></p>

    <h2>What are you buying?</h2>
    <label for="summary">A short name for the whole request</label>
    <input
      type="text"
      name="summary"
      id="summary"
      placeholder="e.g. Filament restock"
      required
    />
    <p>
      <small
        >List each shop or website separately; one shop can supply several
        items.</small
      >
    </p>
    <div class="stack" data-shop-entries>
      ${joinHtml(
        Array.from({length: SHOP_ENTRIES}, (_, index) => renderShopEntry(index))
      )}
    </div>
    <button type="button" class="jsonly" data-add-shop>
      + Add another shop
    </button>
    <p class="jsonly" data-cost-check aria-live="polite" hidden></p>

    <label for="justification">Why is it needed?</label>
    <textarea
      name="justification"
      id="justification"
      rows="4"
      required
    ></textarea>

    <button type="submit">Submit purchase request</button>
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
    <div class="stack-large purchase-request">
      <h1>Request a purchase</h1>
      ${viewModel.purchasingAreas.length === 0
        ? renderNoPurchasingAreas()
        : html`${renderBudgets(viewModel)} ${renderForm(viewModel)}`}
    </div>
  `;
