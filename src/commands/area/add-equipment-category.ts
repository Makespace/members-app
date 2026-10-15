import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {canManageAreaEquipment} from '../authentication-helpers/can-manage-area-equipment';

const codec = t.strict({
  areaId: tt.UUID,
  categoryId: tt.UUID,
  name: tt.NonEmptyString,
});

type AddEquipmentCategory = t.TypeOf<typeof codec>;

// The form mints categoryId, so a resubmitted form is a no-op rather than a
// second category. Names are unique within an area, ignoring case.
const process: Command<AddEquipmentCategory>['process'] = input => {
  const {areaId, categoryId} = input.command;
  const name = input.command.name.trim();
  if (O.isNone(input.rm.area.get(areaId))) {
    return TE.left(failureWithStatus('No such area', StatusCodes.NOT_FOUND)());
  }
  const existing = input.rm.area.getEquipmentCategories(areaId);
  if (existing.some(category => category.id === categoryId)) {
    return TE.right(O.none);
  }
  if (name === '') {
    return TE.left(
      failureWithStatus('A category needs a name', StatusCodes.BAD_REQUEST)()
    );
  }
  if (
    existing.some(
      category => category.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    return TE.left(
      failureWithStatus(
        `This area already has a category called '${name}'`,
        StatusCodes.BAD_REQUEST
      )()
    );
  }
  return TE.right(
    O.some(
      constructEvent('AreaEquipmentCategoryAdded')({
        areaId,
        categoryId,
        name,
        actor: input.command.actor,
      })
    )
  );
};

export const addEquipmentCategory: Command<AddEquipmentCategory> = {
  process,
  decode: codec.decode,
  isAuthorized: canManageAreaEquipment,
};
