import {EquipmentCategory} from '../types/equipment-category';
import {toSlug} from './slug';

// equipment.makespace.org files a machine under its area (/wood-shop/band-saw)
// but files orange and green equipment under the colour instead
// (/orange-equipment/dremel). Derived rather than stored: there is nothing in
// the app recording these addresses, and a guessable URL that is right for
// most machines beats no link at all - a member who lands on a miss can still
// use the site's own navigation.
export const equipmentGuideUrl = (
  areaName: string,
  equipmentName: string,
  category: EquipmentCategory
) => {
  const section =
    category === 'red' ? toSlug(areaName) : `${category}-equipment`;
  return `https://equipment.makespace.org/${section}/${toSlug(equipmentName)}`;
};
