import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {constructEvent, isEventOfType} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  areaId: tt.UUID,
});

type RemoveOwner = t.TypeOf<typeof codec>;

const process: Command<RemoveOwner>['process'] = input => {
   if (input.events.length === 0) {
     return TE.left(
       failureWithStatus(
         'The requested area does not exist',
         StatusCodes.NOT_FOUND
       )()
     );
   }
   if (pipe(input.events, RA.some(isEventOfType('AreaRemoved')))) {
     return TE.left(
       failureWithStatus(
         'The requested area does not exist',
         StatusCodes.NOT_FOUND
       )()
     );
   }

  return pipe(
    pipe(
      input.events,
      RA.filter(e => {
        const isAdded = isEventOfType('OwnerAdded')(e);
        const isRemoved  = isEventOfType('OwnerRemoved')(e);
        if (!isAdded && !isRemoved) {
          return false;
        }

        if (e.areaId !== input.command.areaId || e.memberNumber !== input.command.memberNumber) {
          return false;
        }

        return true;
      }),
      RA.last,
      O.filter(isEventOfType('OwnerAdded')),
      O.map(() => constructEvent('OwnerRemoved')(input.command))
    ),
    O.match(
      () =>
        TE.left(
          failureWithStatus(
            'The requested member is not an owner of the requested area',
            StatusCodes.BAD_REQUEST
          )()
        ),
      event => TE.right(O.some(event))
    )
  );
}

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
