import * as E from 'fp-ts/Either';
import {
  normalisePurchases,
  shopTotalPence,
  totalPence,
  typedPurchases,
} from '../../src/purchasing/purchases';
import {getRightOrFail} from '../helpers';

const item = (fields: Record<string, string>) => ({
  url: '',
  sku: '',
  quantity: '1',
  price: '10',
  notes: '',
  ...fields,
});

const problem = (raw: Parameters<typeof typedPurchases>[0]) =>
  E.isLeft(normalisePurchases(typedPurchases(raw)))
    ? (normalisePurchases(typedPurchases(raw)) as E.Left<string>).left
    : 'no problem';

describe('purchases', () => {
  describe('as typed', () => {
    it('leaves out blank shops and blank items, keeping the order', () => {
      expect(
        typedPurchases([
          {shop: '', delivery: '', items: [{url: '', sku: ''}]},
          {
            shop: 'jewson.co.uk',
            items: [
              {sku: ''},
              {sku: 'PEGF8418', quantity: '1'},
              {sku: 'PBJT4750', quantity: '4', notes: '4.8m'},
            ],
          },
        ])
      ).toStrictEqual([
        {
          shop: 'jewson.co.uk',
          delivery: '',
          items: [
            {url: '', sku: 'PEGF8418', quantity: '1', price: '', notes: ''},
            {url: '', sku: 'PBJT4750', quantity: '4', price: '', notes: '4.8m'},
          ],
        },
      ]);
    });

    it('has no shops when none were sent', () => {
      expect(typedPurchases(undefined)).toStrictEqual([]);
    });
  });

  describe('checked', () => {
    it('reads each item, tidying the link and leaving out what was not given', () => {
      const purchases = getRightOrFail(
        normalisePurchases(
          typedPurchases([
            {
              shop: ' jewson.co.uk ',
              delivery: '25',
              items: [
                item({
                  url: 'www.jewson.co.uk/p/joist-PBJT4750',
                  sku: 'PBJT4750',
                  quantity: '4',
                  price: '12.50',
                  notes: '4.8m',
                }),
              ],
            },
          ])
        )
      );
      expect(purchases).toStrictEqual([
        {
          shop: 'jewson.co.uk',
          items: [
            {
              url: 'https://www.jewson.co.uk/p/joist-PBJT4750',
              sku: 'PBJT4750',
              quantity: 4,
              unitPricePence: 1_250,
              notes: '4.8m',
            },
          ],
          deliveryPence: 2_500,
        },
      ]);
      expect(shopTotalPence(purchases[0])).toBe(7_500);
      expect(totalPence(purchases)).toBe(7_500);
    });

    it('needs at least one shop', () => {
      expect(problem([])).toBe(
        'Please add at least one shop or website to buy from.'
      );
    });

    it('needs the shop named', () => {
      expect(problem([{items: [item({sku: 'A'})]}])).toBe(
        'Shop 1: please say which shop or website.'
      );
    });

    it('needs at least one item from each shop', () => {
      expect(problem([{shop: 'jewson.co.uk', delivery: '5'}])).toBe(
        'jewson.co.uk: please add at least one item.'
      );
    });

    it('needs to know what each item is', () => {
      expect(
        problem([{shop: 'jewson.co.uk', items: [item({quantity: '2'})]}])
      ).toBe(
        'jewson.co.uk, item 1: please give a link, SKU or note saying what it is.'
      );
    });

    it.each([
      ['', 'please give a quantity.'],
      ['two', 'the quantity should be a whole number, e.g. 4.'],
      ['1.5', 'the quantity should be a whole number, e.g. 4.'],
      ['0', 'the quantity should be a whole number, e.g. 4.'],
    ])('turns down a quantity of "%s"', (quantity, message) => {
      expect(
        problem([{shop: 'J', items: [item({sku: 'A'}), item({sku: 'B', quantity})]}])
      ).toBe(`J, item 2: ${message}`);
    });

    it('needs a price for each item', () => {
      expect(problem([{shop: 'J', items: [item({sku: 'A', price: ''})]}])).toBe(
        'J, item 1: please say how much each one costs.'
      );
    });

    it('turns down amounts that are not in pounds', () => {
      expect(problem([{shop: 'J', items: [item({sku: 'A', price: 'lots'})]}])).toBe(
        'J, item 1: amounts should be in pounds, e.g. 42.50.'
      );
      expect(
        problem([{shop: 'J', delivery: 'free', items: [item({sku: 'A'})]}])
      ).toBe('J delivery: amounts should be in pounds, e.g. 42.50.');
    });

    it('turns down a link that is not a web address', () => {
      expect(
        problem([{shop: 'J', items: [item({url: 'ftp://a.b'})]}])
      ).toBe('J, item 1: the link must be a web address (http or https).');
    });
  });
});
