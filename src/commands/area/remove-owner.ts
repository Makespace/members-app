import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  areaId: tt.UUID,
});

type RemoveOwner = t.TypeOf<typeof codec>;

const process: Command<RemoveOwner>['process'] = input =>
  pipe(
    input.rm.area.get(input.command.areaId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.chain(area =>
      area.owners.some(owner =>
        allMemberNumbers(owner).includes(input.command.memberNumber)
      )
        ? TE.right(O.some(constructEvent('OwnerRemoved')(input.command)))
        : TE.left(
            failureWithStatus(
              'The requested member is not an owner of the requested area',
              StatusCodes.BAD_REQUEST
            )()
          )
    ),
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
