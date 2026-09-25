import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {SharedReadModel} from '../../read-models/shared-state';
import {equipmentSlug, toSlug} from '../../templates/slug';

// Trouble tickets can be pointed at one machine or one area - from a QR code
// on the machine, from its page in the app, or from an area's noticeboard -
// so that both reporting a problem and reading what has been reported start
// from the thing in front of you.
export type Focus = {
  kind: 'equipment' | 'area';
  // The real id, which is what tickets are matched against.
  id: string;
  // The readable form, for links a page builds.
  slug: string;
  name: string;
  // For equipment, the area it sits in: the page can then say where the
  // machine is, and offer to widen to everything in that area.
  areaName: O.Option<string>;
  areaId: O.Option<string>;
  areaSlug: O.Option<string>;
};

// A sign carries a readable slug (wood-shop-band-saw); older codes and links
// carry a uuid. Both resolve, so nothing already printed breaks. An unknown
// reference is ignored rather than refused: a QR code outliving the machine
// it names should still lead somewhere useful.
export const resolveFocus = (
  rm: SharedReadModel,
  params: {equipmentId?: string; areaId?: string}
): O.Option<Focus> => {
  const areaNames = new Map(
    rm.area.getAllMinimal().map(area => [area.id as string, area.name])
  );
  const equipmentFocus: O.Option<Focus> = pipe(
    O.fromNullable(params.equipmentId),
    O.chain(reference =>
      pipe(
        rm.equipment
          .getAllMinimal()
          .find(
            item =>
              item.id === reference ||
              equipmentSlug(
                areaNames.get(item.areaId as string) ?? '',
                item.name
              ) === reference.toLowerCase()
          ),
        O.fromNullable
      )
    ),
    O.map(item => {
      const areaName = O.fromNullable(areaNames.get(item.areaId as string));
      return {
        kind: 'equipment' as const,
        id: item.id as string,
        slug: equipmentSlug(O.getOrElse(() => '')(areaName), item.name),
        name: item.name,
        areaName,
        areaId: O.some(item.areaId as string),
        areaSlug: pipe(areaName, O.map(toSlug)),
      };
    })
  );
  const areaFocus: O.Option<Focus> = pipe(
    O.fromNullable(params.areaId),
    O.chain(reference =>
      pipe(
        [...areaNames.entries()].find(
          ([id, name]) =>
            id === reference || toSlug(name) === reference.toLowerCase()
        ),
        O.fromNullable,
        O.map(([id, name]) => ({
          kind: 'area' as const,
          id,
          slug: toSlug(name),
          name,
          areaName: O.none as O.Option<string>,
          areaId: O.none as O.Option<string>,
          areaSlug: O.none as O.Option<string>,
        }))
      )
    )
  );
  return pipe(
    equipmentFocus,
    O.alt(() => areaFocus)
  );
};
