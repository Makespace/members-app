import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
});

type RemoveArea = t.TypeOf<typeof codec>;

const process: Command<RemoveArea>['process'] = input =>
  pipe(
    input.rm.area.get(input.command.id),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.map(() => O.some(constructEvent('AreaRemoved')(input.command)))
  );

const resource: Command<RemoveArea>['resource'] = command => ({
  type: 'Area',
  id: command.id,
});

export const removeArea: Command<RemoveArea> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
