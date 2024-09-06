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

type RemoveArea = t.TypeOf<typeof codec>;

const process: Command<RemoveArea>['process'] = input => {
  if (input.events.length === 0) {
    return O.none;
  }
  return pipe(
    input.events,
    RA.filter(isEventOfType('AreaRemoved')),
    RA.match(
      () => O.some(constructEvent('AreaRemoved')(input.command)),
      () => O.none
    )
  );
};

const resource: Command<RemoveArea>['resource'] = command => ({
  type: 'Area',
  id: command.id,
});

export const remove: Command<RemoveArea> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
