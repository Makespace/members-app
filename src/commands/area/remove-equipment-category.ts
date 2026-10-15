import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {canManageAreaEquipment} from '../authentication-helpers/can-manage-area-equipment';

const codec = t.strict({
  areaId: tt.UUID,
  categoryId: tt.UUID,
});

type RemoveEquipmentCategory = t.TypeOf<typeof codec>;

// No-op when the category is already gone (or belongs to another area).
const process: Command<RemoveEquipmentCategory>['process'] = input =>
  TE.right(
    input.rm.area
      .getEquipmentCategories(input.command.areaId)
      .some(category => category.id === input.command.categoryId)
      ? O.some(
          constructEvent('AreaEquipmentCategoryRemoved')({
            areaId: input.command.areaId,
            categoryId: input.command.categoryId,
            actor: input.command.actor,
          })
        )
      : O.none
  );

export const removeEquipmentCategory: Command<RemoveEquipmentCategory> = {
  process,
  decode: codec.decode,
  isAuthorized: canManageAreaEquipment,
};
