import {html, joinHtml, sanitizeString} from '../types/html';
import {formatPence} from '../types/money';
import {
  lineTotalPence,
  Purchase,
  PurchaseItem,
  shopTotalPence,
} from '../purchasing/purchases';

// What a purchase request buys, shop by shop: each item with its link, SKU,
// notes, quantity, price and cost, then delivery and the shop's subtotal, and
// the total at the end. Used before sending (the form's last page) and on the
// request's own page.

const money = (pence: number) => sanitizeString(formatPence(pence));

const isWebLink = (link: string) => /^https?:\/\//i.test(link);

const renderLink = (url: string | null) =>
  url !== null && isWebLink(url)
    ? html`<a href="${sanitizeString(url)}" target="_blank" rel="noopener"
        >${sanitizeString(new URL(url).hostname.replace(/^www\./, ''))}</a
      >`
    : html``;

const renderItem = (item: PurchaseItem) => html`
  <tr>
    <td>${renderLink(item.url)}</td>
    <td>${sanitizeString(item.sku ?? '')}</td>
    <td class="purchase-breakdown__notes">
      ${sanitizeString(item.notes ?? '')}
    </td>
    <td class="purchase-breakdown__number">${item.quantity}</td>
    <td class="purchase-breakdown__number">${money(item.unitPricePence)}</td>
    <td class="purchase-breakdown__number">${money(lineTotalPence(item))}</td>
  </tr>
`;

const renderShop = (purchase: Purchase) => html`
  <tbody>
    <tr class="purchase-breakdown__shop">
      <th colspan="6" scope="rowgroup">${sanitizeString(purchase.shop)}</th>
    </tr>
    ${joinHtml(purchase.items.map(renderItem))}
    ${purchase.deliveryPence > 0
      ? html`<tr>
          <td colspan="5">Delivery</td>
          <td class="purchase-breakdown__number">
            ${money(purchase.deliveryPence)}
          </td>
        </tr>`
      : html``}
    <tr class="purchase-breakdown__subtotal">
      <td colspan="5">${sanitizeString(purchase.shop)} total</td>
      <td class="purchase-breakdown__number">
        ${money(shopTotalPence(purchase))}
      </td>
    </tr>
  </tbody>
`;

export const renderPurchaseBreakdown = (
  purchases: ReadonlyArray<Purchase>,
  totalPence: number
) => html`
  <div class="purchase-breakdown__scroll">
    <table class="purchase-breakdown">
      <thead>
        <tr>
          <th>Link</th>
          <th>SKU</th>
          <th>Notes</th>
          <th class="purchase-breakdown__number">Qty</th>
          <th class="purchase-breakdown__number">Each</th>
          <th class="purchase-breakdown__number">Cost</th>
        </tr>
      </thead>
      ${joinHtml(purchases.map(renderShop))}
      <tfoot>
        <tr>
          <th colspan="5">Total</th>
          <td class="purchase-breakdown__number">${money(totalPence)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
`;
