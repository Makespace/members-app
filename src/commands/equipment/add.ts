import {DomainEvent, constructEvent} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
  name: tt.NonEmptyString,
  areaId: tt.UUID,
});

type AddEquipment = t.TypeOf<typeof codec>;

const process = (input: {
  command: AddEquipment;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    RA.match(
      () => O.some(constructEvent('EquipmentAdded')(input.command)),
      () => O.none
    )
  );

const resource = (command: AddEquipment) => ({
  type: 'Equipment',
  id: command.id,
});

export const add: Command<AddEquipment> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
