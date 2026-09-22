import * as t from 'io-ts';

// Makespace's physical sticker system. Red equipment requires training and
// carries trainers/quiz machinery in the app; orange and green do not.
export const EquipmentCategoryCodec = t.keyof({
  red: null,
  orange: null,
  green: null,
});

export type EquipmentCategory = t.TypeOf<typeof EquipmentCategoryCodec>;
