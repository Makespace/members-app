import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {MinimalEquipment} from '../../read-models/shared-state/return-types';
import {canManageAreaEquipment} from '../authentication-helpers/can-manage-area-equipment';

// The category table posts one radio per machine as
// assignments[<equipmentId>]=<categoryId>, or '' for uncategorised. An area
// with no visible equipment posts no assignments at all.
const codec = t.strict({
  areaId: tt.UUID,
  assignments: tt.withFallback(t.record(t.string, t.string), {}),
});

type SetEquipmentCategories = t.TypeOf<typeof codec>;

// Saves the whole table at once, as one event holding only the machines whose
// category actually changed; nothing changed means no event.
const process: Command<SetEquipmentCategories>['process'] = input => {
  const {areaId, assignments} = input.command;
  if (O.isNone(input.rm.area.get(areaId))) {
    return TE.left(failureWithStatus('No such area', StatusCodes.NOT_FOUND)());
  }
  const categoryIds = new Set<string>(
    input.rm.area.getEquipmentCategories(areaId).map(category => category.id)
  );
  const equipment = new Map<string, MinimalEquipment>(
    input.rm.equipment
      .getForAreaMinimal(areaId)
      .map(item => [item.id, item])
  );
  const changes: {equipmentId: UUID; categoryId: UUID | null}[] = [];
  for (const [equipmentId, chosen] of Object.entries(assignments)) {
    const current = equipment.get(equipmentId);
    if (current === undefined) {
      return TE.left(
        failureWithStatus(
          'Some of that equipment is not in this area',
          StatusCodes.BAD_REQUEST
        )()
      );
    }
    if (chosen !== '' && !categoryIds.has(chosen)) {
      return TE.left(
        failureWithStatus(
          'One of those categories no longer exists - reload the page and try again',
          StatusCodes.BAD_REQUEST
        )()
      );
    }
    const categoryId = chosen === '' ? null : (chosen as UUID);
    if (O.toNullable(current.areaCategoryId) !== categoryId) {
      changes.push({equipmentId: current.id, categoryId});
    }
  }
  return TE.right(
    changes.length === 0
      ? O.none
      : O.some(
          constructEvent('AreaEquipmentCategoriesAssigned')({
            areaId,
            assignments: changes,
            actor: input.command.actor,
          })
        )
  );
};

export const setEquipmentCategories: Command<SetEquipmentCategories> = {
  process,
  decode: codec.decode,
  isAuthorized: canManageAreaEquipment,
};
