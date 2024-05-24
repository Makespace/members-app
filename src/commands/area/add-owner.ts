import {DomainEvent, constructEvent} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';

const codec = t.strict({
  areaId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

type AddOwner = t.TypeOf<typeof codec>;

const process = (input: {
  command: AddOwner;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> =>
  pipe(
    input.events,
    RA.match(
      () => O.some(constructEvent('OwnerAdded')(input.command)),
      () => O.none
    )
  );

const resource = (command: AddOwner) => ({
  type: 'Area',
  id: command.areaId,
});

export const addOwner: Command<AddOwner> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
