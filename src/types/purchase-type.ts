import * as t from 'io-ts';

// What kind of purchase a request is, chosen first on the request form.
// Improvements come out of the purchasing area's yearly budget. Repairs and
// running costs don't (though a large one needs a super user's approval),
// and neither do member-paid purchases (e.g. 3D printer filament, paid for on
// SumUp when it's used).
export const PurchaseTypeCodec = t.keyof({
  repairs: null,
  improvements: null,
  'member-paid': null,
});

export type PurchaseType = t.TypeOf<typeof PurchaseTypeCodec>;

export const purchaseTypes: ReadonlyArray<{
  type: PurchaseType;
  label: string;
  description: string;
}> = [
  {
    type: 'repairs',
    label: 'Repairs & Running Costs',
    description: 'Operational costs of running your Area',
  },
  {
    type: 'improvements',
    label: 'Improvements',
    description: 'Expanding the functionality of your Area',
  },
  {
    type: 'member-paid',
    label: 'Member-paid',
    description: 'Members pay for these when they use them',
  },
];

export const purchaseTypeLabel = (type: PurchaseType): string =>
  purchaseTypes.find(found => found.type === type)?.label ?? type;
