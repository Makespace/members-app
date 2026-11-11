import * as t from 'io-ts';

// What kind of purchase a request is, chosen first on the request form.
// Maintenance, improvements and non-recoverable consumables all come out of
// the purchasing area's single yearly budget; recoverable consumables (e.g.
// 3D printer filament, paid for on SumUp when it's used) are member-paid and
// don't. Maintenance keeps its old stored value, 'repairs'.
export const PurchaseTypeCodec = t.keyof({
  repairs: null,
  improvements: null,
  'non-recoverable-consumables': null,
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
    label: 'Maintenance',
    description:
      'Routine services, unplanned repairs and like-for-like replacements',
  },
  {
    type: 'improvements',
    label: 'Improvements',
    description: 'New equipment, or upgrading existing equipment',
  },
  {
    type: 'non-recoverable-consumables',
    label: 'Non-recoverable consumables',
    description: "Consumables members don't pay for, e.g. solder",
  },
  {
    type: 'member-paid',
    label: 'Recoverable consumables',
    description: 'Members pay for these when they use them, e.g. filament',
  },
];

export const purchaseTypeLabel = (type: PurchaseType): string =>
  purchaseTypes.find(found => found.type === type)?.label ?? type;
