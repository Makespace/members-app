import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {constructEvent, isEventOfType} from '../../types';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  areaId: tt.UUID,
});

type RemoveOwner = t.TypeOf<typeof codec>;

const process: Command<RemoveOwner>['process'] = input =>
  pipe(
    input.events,
    RA.last,
    O.filter(isEventOfType('OwnerAdded')),
    O.map(() => constructEvent('OwnerRemoved')(input.command))
  );

const resource: Command<RemoveOwner>['resource'] = command => ({
  type: 'Area',
  id: command.areaId,
});

export const removeOwner: Command<RemoveOwner> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
