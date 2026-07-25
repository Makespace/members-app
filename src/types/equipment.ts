import * as t from 'io-ts';

// Makespace equipment classes. Red equipment needs training (training sheet + trainers);
// Orange and Green equipment do not. Existing equipment predates this field and is treated
// as Red.
export const EquipmentClassification = t.keyof({
  Red: null,
  Orange: null,
  Green: null,
});
export type EquipmentClassification = t.TypeOf<typeof EquipmentClassification>;

export const equipmentClassifications: ReadonlyArray<EquipmentClassification> = [
  'Red',
  'Orange',
  'Green',
];
