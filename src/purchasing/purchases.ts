import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {PenceFromPoundsString} from '../types/money';

// What a purchase request buys: one or more shops or websites, each with the
// items bought there and any delivery charge. Read by the submit command and
// by the form's own pages, so both accept and refuse the same things with the
// same messages.

// Posted, or carried in a page link, as purchases[0][shop],
// purchases[0][items][0][sku] etc. Express reads each level as an array - or
// as an object keyed by index once there are more than 20.
const indexed = <C extends t.Mixed>(codec: C) =>
  t.union([t.readonlyArray(codec), t.record(t.string, codec)]);

const RawItem = t.partial({
  url: t.string,
  sku: t.string,
  quantity: t.string,
  // For the whole quantity, in pounds, e.g. "42.50" - so bulk discounts are
  // whatever the shop charges.
  cost: t.string,
  notes: t.string,
});

const RawPurchase = t.partial({
  shop: t.string,
  // In pounds; optional.
  delivery: t.string,
  items: indexed(RawItem),
});

export const RawPurchases = indexed(RawPurchase);

// As typed, in page order, with entirely blank shops and items left out.
export type TypedItem = {
  url: string;
  sku: string;
  quantity: string;
  cost: string;
  notes: string;
};

export type TypedPurchase = {
  shop: string;
  delivery: string;
  items: ReadonlyArray<TypedItem>;
};

// As recorded on the PurchaseRequestSubmitted event and kept in the read
// model.
const PurchaseItemCodec = t.strict({
  url: t.union([t.string, t.null]),
  sku: t.union([t.string, t.null]),
  quantity: t.number,
  // For the whole quantity
  costPence: t.number,
  // e.g. the length or colour wanted, when the item comes in several
  notes: t.union([t.string, t.null]),
});

export const PurchaseCodec = t.strict({
  shop: t.string,
  items: t.readonlyArray(PurchaseItemCodec),
  deliveryPence: t.number,
});

export type PurchaseItem = t.TypeOf<typeof PurchaseItemCodec>;
export type Purchase = t.TypeOf<typeof PurchaseCodec>;

const inOrder = <A>(
  raw: ReadonlyArray<A> | Record<string, A> | undefined
): ReadonlyArray<A> =>
  raw === undefined
    ? []
    : Array.isArray(raw)
      ? (raw as ReadonlyArray<A>)
      : Object.entries(raw)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, entry]) => entry);

const isBlank = (values: ReadonlyArray<string>) =>
  values.every(value => value.trim() === '');

export const typedPurchases = (
  raw: t.TypeOf<typeof RawPurchases> | undefined
): ReadonlyArray<TypedPurchase> =>
  inOrder(raw)
    .map(purchase => ({
      shop: purchase.shop ?? '',
      delivery: purchase.delivery ?? '',
      items: inOrder(purchase.items)
        .map(item => ({
          url: item.url ?? '',
          sku: item.sku ?? '',
          quantity: item.quantity ?? '',
          cost: item.cost ?? '',
          notes: item.notes ?? '',
        }))
        .filter(
          item =>
            !isBlank([item.url, item.sku, item.quantity, item.cost, item.notes])
        ),
    }))
    .filter(
      purchase =>
        !isBlank([purchase.shop, purchase.delivery]) || purchase.items.length > 0
    );

const optional = (value: string) =>
  value.trim() === '' ? null : value.trim();

// Optional. A bare "example.com/thing" is taken to mean https; anything that
// still isn't a web address is refused rather than stored as a broken link.
const normaliseLink = (
  raw: string,
  where: string
): E.Either<string, string | null> => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return E.right(null);
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const refused = E.left(
    `${where}: the link must be a web address (http or https).`
  );
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? E.right(url.toString())
      : refused;
  } catch {
    return refused;
  }
};

const normaliseQuantity = (
  raw: string,
  where: string
): E.Either<string, number> => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return E.left(`${where}: please give a quantity.`);
  }
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0
    ? E.right(Number(trimmed))
    : E.left(`${where}: the quantity should be a whole number, e.g. 4.`);
};

const normaliseMoney = (
  raw: string,
  where: string,
  missing: string
): E.Either<string, number> =>
  raw.trim() === ''
    ? E.left(`${where}: ${missing}`)
    : pipe(
        PenceFromPoundsString.decode(raw),
        E.mapLeft(() => `${where}: amounts should be in pounds, e.g. 42.50.`)
      );

const normaliseItem = (
  item: TypedItem,
  where: string
): E.Either<string, PurchaseItem> =>
  isBlank([item.url, item.sku, item.notes])
    ? E.left(`${where}: please give a link, SKU or note saying what it is.`)
    : pipe(
        E.Do,
        E.bind('url', () => normaliseLink(item.url, where)),
        E.bind('quantity', () => normaliseQuantity(item.quantity, where)),
        E.bind('costPence', () =>
          normaliseMoney(item.cost, where, 'please say how much they cost in total.')
        ),
        E.map(({url, quantity, costPence}) => ({
          url,
          sku: optional(item.sku),
          quantity,
          costPence,
          notes: optional(item.notes),
        }))
      );

const normalisePurchase = (
  purchase: TypedPurchase,
  index: number
): E.Either<string, Purchase> => {
  const shop = purchase.shop.trim();
  if (shop === '') {
    return E.left(`Shop ${index + 1}: please say which shop or website.`);
  }
  if (purchase.items.length === 0) {
    return E.left(`${shop}: please add at least one item.`);
  }
  return pipe(
    E.Do,
    E.bind('items', () =>
      pipe(
        purchase.items,
        E.traverseArrayWithIndex((itemIndex, item) =>
          normaliseItem(item, `${shop}, item ${itemIndex + 1}`)
        )
      )
    ),
    E.bind('deliveryPence', () =>
      purchase.delivery.trim() === ''
        ? E.right(0)
        : normaliseMoney(purchase.delivery, `${shop} delivery`, '')
    ),
    E.map(({items, deliveryPence}) => ({shop, items, deliveryPence}))
  );
};

// At least one shop is required. The first problem found is reported.
export const normalisePurchases = (
  purchases: ReadonlyArray<TypedPurchase>
): E.Either<string, ReadonlyArray<Purchase>> =>
  purchases.length === 0
    ? E.left('Please add at least one shop or website to buy from.')
    : pipe(purchases, E.traverseArrayWithIndex((index, purchase) =>
        normalisePurchase(purchase, index)
      ));

export const shopTotalPence = (purchase: Purchase) =>
  purchase.items.reduce((sum, item) => sum + item.costPence, 0) +
  purchase.deliveryPence;

export const totalPence = (purchases: ReadonlyArray<Purchase>) =>
  purchases.reduce((sum, purchase) => sum + shopTotalPence(purchase), 0);
