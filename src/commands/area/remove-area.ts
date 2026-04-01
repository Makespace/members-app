import {constructEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
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

const process: Command<RemoveArea>['process'] = input => {
  if (
    input.events.length === 0 ||
    pipe(input.events, RA.some(isEventOfType('AreaRemoved')))
  ) {
    return TE.left(
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    );
  }

  return TE.right(O.some(constructEvent('AreaRemoved')(input.command)));
};

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
