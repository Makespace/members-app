import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {constructEvent, isEventOfType} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';
import {filterByName} from '../../types/domain-event';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  areaId: tt.UUID,
});

type RemoveOwner = t.TypeOf<typeof codec>;

const process: Command<RemoveOwner>['process'] = input => {
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

  return pipe(
    input.events,
    filterByName(['OwnerAdded', 'OwnerRemoved']),
    RA.filter(
      event =>
        event.areaId === input.command.areaId &&
        event.memberNumber === input.command.memberNumber
    ),
    RA.last,
    O.filter(isEventOfType('OwnerAdded')),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested member is not an owner of the requested area',
        StatusCodes.BAD_REQUEST
      )()
    ),
    TE.map(() => O.some(constructEvent('OwnerRemoved')(input.command)))
  );
};

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
