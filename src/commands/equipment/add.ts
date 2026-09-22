import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';
import {isAreaOwner} from '../authentication-helpers/is-area-owner';
import {EquipmentCategoryCodec} from '../../types/equipment-category';

// category is optional: everything added before categories existed was
// training-managed, so an absent category means red.
const codec = t.intersection([
  t.strict({
    id: tt.UUID,
    name: tt.NonEmptyString,
    areaId: tt.UUID,
  }),
  t.partial({
    category: EquipmentCategoryCodec,
  }),
]);

export type AddEquipment = t.TypeOf<typeof codec>;

const process: Command<AddEquipment>['process'] = input =>
  TE.right(
    O.isSome(input.rm.equipment.get(input.command.id))
      ? O.none
      : O.some(
          constructEvent('EquipmentAdded')({
            ...input.command,
            category: input.command.category ?? 'red',
          })
        )
  );

// Red equipment brings training machinery (sheets, trainers, quiz results)
// that only admins set up, so it stays admin-only. Orange and green are just
// inventory, so the area's own owners can add them - the same "all owners are
// maintainers" bar used for acting on trouble tickets.
export const add: Command<AddEquipment> = {
  process,
  decode: codec.decode,
  isAuthorized: input =>
    isAdminOrSuperUser(input) ||
    ((input.input.category === 'orange' ||
      input.input.category === 'green') &&
      isAreaOwner({
        actor: input.actor,
        rm: input.rm,
        input: {areaId: input.input.areaId},
      })),
};
