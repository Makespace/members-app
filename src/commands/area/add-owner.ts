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
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

const codec = t.strict({
  areaId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

export type AddOwner = t.TypeOf<typeof codec>;

const process: Command<AddOwner>['process'] = input =>
  pipe(
    input.rm.area.get(input.command.areaId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.map(area =>
      area.owners.some(owner =>
        allMemberNumbers(owner).includes(input.command.memberNumber)
      )
        ? O.none
        : O.some(constructEvent('OwnerAdded')(input.command))
    )
  );

export const addOwner: Command<AddOwner> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
