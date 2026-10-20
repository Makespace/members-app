// The purchase request form, kept in this one file so the design can be
// swapped out wholesale. It is filled in a page at a time, like the Owners'
// Agreement, using the shared pieces in src/templates/multi-page-form.ts:
//
//   1. About the request: which purchasing area, a summary, why it's needed.
//   2. Cost breakdown: each shop, the items wanted from it (link, SKU,
//      quantity, price each, notes) and any delivery - together the cost of
//      the request - and whether it is a consumable members pay for.
//   3. Budget: the area's budget as it stands and which budget this comes out
//      of, worked out on the server, before sending.
//
// Pages 1 and 2 move on with a GET form carrying the answers so far; page 3
// posts everything to the submit command, which works the outcome out again
// itself (src/purchasing/classify-purchase.ts). Which page to show, and what
// is still missing, is decided in submit-form.ts. Everything works without
// JavaScript; on page 2 a small script adds and removes shops and items and
// keeps running totals.
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
import {
  backHref,
  hiddenInputs,
  renderStepNav,
  renderStepProgress,
  StepValues,
} from '../../templates/multi-page-form';

export const PAGE_LABELS = [
  'About the request',
  'Cost breakdown',
  'Budget',
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
  // The shops and their items as typed, blank ones already left out.
  purchases: ReadonlyArray<TypedPurchase>;
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
  // What still needs sorting out, when they asked for a later page.
  problems: ReadonlyArray<string>;
  // Known from page 2 on.
  chosen: O.Option<PurchasingAreaOption>;
  // Known on page 3: the shops, their total, and what that means.
  result: O.Option<{
    purchases: ReadonlyArray<Purchase>;
    totalPence: number;
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
              >Cost</label
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
              >For the whole quantity, after any discount.</span
            >
          </div>
        </div>
        <div class="purchase-field">
          <label class="purchase-field__label" for="${id('notes')}"
            >Notes
            <span class="purchase-request__hint purchase-request__normal"
              >(optional)</span
            ></label
          >
          <span class="purchase-request__hint text-sm"
            >Anything needed to buy the right one, e.g. a length, size or
            colour.</span
          >
          <input
            type="text"
            name="${name('notes')}"
            id="${id('notes')}"
            value="${sanitizeString(item.notes)}"
          />
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
    <div class="purchase-shop__row">
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
  ].filter(([, value]) => value !== '');

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

// One outcome's box: its colour, tag and heading, with the explanation and
// anything else below.
const renderVerdictBox = (
  outcome: Classification['outcome'],
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

const renderCostsPage = (viewModel: PurchaseRequestFormViewModel) => html`
  <form method="get" class="purchase-request__sections" id="purchase-costs-form">
    <input type="hidden" name="step" value="3" />
    ${hiddenInputs(
      carriedExcept(
        viewModel,
        name =>
          name.startsWith('purchases[') || name === 'isMemberPaidConsumable'
      )
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
  ${costsScript}
`;

const renderBudgetPage = (viewModel: PurchaseRequestFormViewModel) => html`
  ${pipe(
    viewModel.chosen,
    O.match(() => html``, renderBudget(viewModel.budgetYear))
  )}
  ${pipe(
    viewModel.result,
    O.match(
      () => html``,
      ({purchases, totalPence, classification}) => html`
        ${renderVerdictBox(
          classification.outcome,
          html`For the ${gbp(totalPence)} total`,
          html`${sanitizeString(classification.reason)}`
        )}
        ${renderPurchaseBreakdown(purchases, totalPence)}
      `
    )
  )}
  <form
    action="/purchase-requests/submit?next=${safe(
      encodeURIComponent(`/purchase-requests/view/${viewModel.requestId}?sent=1`)
    )}"
    method="post"
  >
    ${hiddenInputs(carried(viewModel))}
    ${renderStepNav({
      back: backHref(viewModel.step, carried(viewModel)),
      next: html`<button type="submit">Send request</button>`,
    })}
  </form>
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

      function isBlank(entry) {
        return Array.prototype.every.call(
          entry.querySelectorAll('input'),
          function (field) { return field.value.trim() === ''; }
        );
      }

      // Each shop's subtotal (its items' costs plus delivery) and the
      // request's total, which is what decides the budget.
      function update() {
        var total = 0;
        shops.querySelectorAll('[data-shop-entry]').forEach(function (shop) {
          var sum = pence(shop.querySelector('[data-shop-delivery]').value) || 0;
          shop.querySelectorAll('[data-item-entry]').forEach(function (item) {
            sum += pence(item.querySelector('[data-item-cost]').value) || 0;
          });
          shop.querySelector('[data-shop-total]').innerHTML =
            sum ? '<p>Shop total: ' + gbp(sum) + '</p>' : '';
          total += sum;
        });
        requestTotal.innerHTML = total ? '<p><strong>Total: ' + gbp(total) + '</strong></p>' : '';
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
        copy.querySelectorAll('input').forEach(function (field) {
          field.value = '';
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

      form.addEventListener('input', update);
      update();
    })();
  </script>
`;

const pages = [renderAboutPage, renderCostsPage, renderBudgetPage];

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
