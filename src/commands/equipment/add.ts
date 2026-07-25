import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';
import {EquipmentClassification} from '../../types/equipment';

const codec = t.intersection([
  t.strict({
    id: tt.UUID,
    name: tt.NonEmptyString,
    areaId: tt.UUID,
  }),
  // Optional on the wire; omitted means Red (the training-required default).
  t.partial({
    classification: EquipmentClassification,
  }),
]);

export type AddEquipment = t.TypeOf<typeof codec>;

const process: Command<AddEquipment>['process'] = input =>
  TE.right(
    O.isSome(input.rm.equipment.get(input.command.id))
      ? O.none
      : O.some(
          constructEvent('EquipmentAdded')({
            id: input.command.id,
            name: input.command.name,
            areaId: input.command.areaId,
            classification: input.command.classification ?? 'Red',
            actor: input.command.actor,
          })
        )
  );

export const add: Command<AddEquipment> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
