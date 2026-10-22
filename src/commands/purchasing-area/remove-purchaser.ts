import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  memberNumber: tt.NumberFromString,
});

type RemovePurchaser = t.TypeOf<typeof codec>;

const process: Command<RemovePurchaser>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.chain(purchasingArea =>
      purchasingArea.purchasers.some(purchaser =>
        allMemberNumbers(purchaser).includes(input.command.memberNumber)
      )
        ? TE.right(O.some(constructEvent('PurchaserRemoved')(input.command)))
        : TE.left(
            failureWithStatus(
              'The requested member is not a purchaser for the requested purchasing area',
              StatusCodes.BAD_REQUEST
            )()
          )
    )
  );

export const removePurchaser: Command<RemovePurchaser> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
