import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
});

type RemovePurchasingArea = t.TypeOf<typeof codec>;

// One with purchase requests or recorded spending is refused, so their
// history keeps its purchasing area; deactivate it instead.
const process: Command<RemovePurchasingArea>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.chain(purchasingArea =>
      input.rm.purchasing.hasHistory(purchasingArea.id)
        ? TE.left(
            failureWithStatus(
              `${purchasingArea.name} has purchase requests or recorded spending, so it can't be removed. Deactivate it instead.`,
              StatusCodes.BAD_REQUEST
            )()
          )
        : TE.right(
            O.some(constructEvent('PurchasingAreaRemoved')(input.command))
          )
    )
  );

export const remove: Command<RemovePurchasingArea> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
