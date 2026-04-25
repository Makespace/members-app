import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
  name: tt.NonEmptyString,
  areaId: tt.UUID,
});

export type AddEquipment = t.TypeOf<typeof codec>;

const process: Command<AddEquipment>['process'] = input =>
  TE.right(
    O.isSome(input.rm.equipment.get(input.command.id))
      ? O.none
      : O.some(constructEvent('EquipmentAdded')(input.command))
  );

const resource: Command<AddEquipment>['resource'] = command => ({
  type: 'Equipment',
  id: command.id,
});

export const add: Command<AddEquipment> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
