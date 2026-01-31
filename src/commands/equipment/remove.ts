import {constructEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
});

type RemoveEquipment = t.TypeOf<typeof codec>;

const process: Command<RemoveEquipment>['process'] = input => {
  if (input.events.length === 0) {
    return O.none;
  }
  return pipe(
    input.events,
    RA.filter(isEventOfType('EquipmentRemoved')),
    RA.match(
      () => O.some(constructEvent('EquipmentRemoved')(input.command)),
      () => O.none
    )
  );
};

const resource: Command<RemoveEquipment>['resource'] = command => ({
  type: 'Equipment',
  id: command.id,
});

export const removeEquipment: Command<RemoveEquipment> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
