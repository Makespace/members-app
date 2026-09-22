import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {EquipmentCategoryCodec} from '../../types/equipment-category';

const codec = t.strict({
  equipmentId: tt.UUID,
  category: EquipmentCategoryCodec,
});

type SetEquipmentCategory = t.TypeOf<typeof codec>;

// Recategorise equipment. No-op when the category already matches.
const process: Command<SetEquipmentCategory>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    TE.map(equipment =>
      equipment.category === input.command.category
        ? O.none
        : O.some(
            constructEvent('EquipmentCategoryChanged')({
              equipmentId: input.command.equipmentId,
              category: input.command.category,
              actor: input.command.actor,
            })
          )
    )
  );

export const setCategory: Command<SetEquipmentCategory> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
