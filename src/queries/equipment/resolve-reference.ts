import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../../dependencies';
import {equipmentSlug} from '../../templates/slug';

// Signs print an equipment page's address for someone to type when their
// camera will not scan the code, so a machine answers to its readable slug
// (wood-shop-band-saw) as well as to its uuid. uuids keep working, so every
// link already sent out is unaffected.
export const resolveEquipmentReference =
  (deps: Dependencies) =>
  (reference: string): O.Option<UUID> => {
    if (UUID.is(reference)) {
      return O.some(reference);
    }
    const areaNames = new Map(
      deps.sharedReadModel.area
        .getAllMinimal()
        .map(area => [area.id as string, area.name])
    );
    return pipe(
      deps.sharedReadModel.equipment
        .getAllMinimal()
        .find(
          item =>
            equipmentSlug(
              areaNames.get(item.areaId as string) ?? '',
              item.name
            ) === reference.toLowerCase()
        ),
      O.fromNullable,
      O.map(item => item.id)
    );
  };
