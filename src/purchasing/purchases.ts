import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {PenceFromPoundsString} from '../types/money';

// The shops or websites a purchase request buys from, as typed into the form:
// read by the submit command and by the form's own pages, so both accept and
// refuse the same things with the same messages.

// One shop, as typed. The form offers a few blank entries (more with
// JavaScript), so entirely blank ones are ignored. Posted, or carried in a
// page link, as purchases[0][shop] etc., which Express reads as an array - or
// as an object keyed by index once there are more than 20.
const RawPurchase = t.partial({
  shop: t.string,
  link: t.string,
  items: t.string,
  // In pounds, e.g. "42.50".
  cost: t.string,
});
export type RawPurchase = t.TypeOf<typeof RawPurchase>;

export const RawPurchases = t.union([
  t.readonlyArray(RawPurchase),
  t.record(t.string, RawPurchase),
]);

export type Purchase = {
  shop: string;
  link: string | null;
  items: string;
  costPence: number;
};

// In page order, whichever way they arrived; nothing at all is no shops.
export const rawPurchasesInOrder = (
  raw: t.TypeOf<typeof RawPurchases> | undefined
): ReadonlyArray<RawPurchase> =>
  raw === undefined
    ? []
    : Array.isArray(raw)
      ? (raw as ReadonlyArray<RawPurchase>)
      : Object.entries(raw)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, entry]) => entry);

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

const normaliseCost = (raw: string, where: string): E.Either<string, number> =>
  raw.trim() === ''
    ? E.left(`${where}: please say how much it costs.`)
    : pipe(
        PenceFromPoundsString.decode(raw),
        E.mapLeft(() => `${where}: the cost should be in pounds, e.g. 42.50.`)
      );

const normalisePurchase = (
  raw: RawPurchase,
  where: string
): E.Either<string, O.Option<Purchase>> => {
  const shop = (raw.shop ?? '').trim();
  const items = (raw.items ?? '').trim();
  const link = raw.link ?? '';
  const cost = raw.cost ?? '';
  if (shop === '' && items === '' && link.trim() === '' && cost.trim() === '') {
    return E.right(O.none);
  }
  if (shop === '') {
    return E.left(`${where}: please say which shop or website.`);
  }
  if (items === '') {
    return E.left(`${where}: please list what to buy from ${shop}.`);
  }
  return pipe(
    E.Do,
    E.bind('link', () => normaliseLink(link, shop)),
    E.bind('costPence', () => normaliseCost(cost, shop)),
    E.map(({link, costPence}) => O.some({shop, link, items, costPence}))
  );
};

// Blank entries dropped; at least one shop is required. The first problem
// found is reported.
export const normalisePurchases = (
  raw: ReadonlyArray<RawPurchase>
): E.Either<string, ReadonlyArray<Purchase>> => {
  const purchases: Purchase[] = [];
  for (const [index, entry] of raw.entries()) {
    const normalised = normalisePurchase(entry, `Shop ${index + 1}`);
    if (E.isLeft(normalised)) {
      return normalised;
    }
    if (O.isSome(normalised.right)) {
      purchases.push(normalised.right.value);
    }
  }
  return purchases.length === 0
    ? E.left('Please add at least one shop or website to buy from.')
    : E.right(purchases);
};

export const totalPence = (purchases: ReadonlyArray<Purchase>) =>
  purchases.reduce((sum, purchase) => sum + purchase.costPence, 0);
