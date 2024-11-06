import {constructEvent, isEventOfType} from '../../types';
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

const process: Command<AddOwner>['process'] = input => {
  if (input.events.length === 0) {
    return O.none;
  }
  if (pipe(input.events, RA.some(isEventOfType('AreaRemoved')))) {
    return O.none;
  }

  return pipe(
    input.events,
    RA.filter(isEventOfType('OwnerAdded')),
    RA.filter(event => event.memberNumber === input.command.memberNumber),
    RA.match(
      () => O.some(constructEvent('OwnerAdded')(input.command)),
      () => O.none
    )
  );
};

const resource: Command<AddOwner>['resource'] = (command: AddOwner) => ({
  type: 'Area',
  id: command.areaId,
});

export const addOwner: Command<AddOwner> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
