import {constructEvent} from '../../types';
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
});

type CreateArea = t.TypeOf<typeof codec>;

const process: Command<CreateArea>['process'] = input =>
  pipe(
    input.events,
    RA.match(
      () => O.some(constructEvent('AreaCreated')(input.command)),
      () => O.none
    )
  );

const resource: Command<CreateArea>['resource'] = command => ({
  type: 'Area',
  id: command.id,
});

export const create: Command<CreateArea> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
