import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {PositivePenceFromPoundsString} from '../../types/money';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  // In pounds, e.g. "500.00"; recorded in pence.
  smallRepairsAmount: PositivePenceFromPoundsString,
});

type SetSmallRepairsAmount = t.TypeOf<typeof codec>;

// How much a single repair can cost before it needs a super user's approval.
// Only requests made after the change are affected: each request's approval
// was worked out, and recorded, when it was made.
const process: Command<SetSmallRepairsAmount>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.smallRepairsAmountPence ===
      input.command.smallRepairsAmount
        ? O.none
        : O.some(
            constructEvent('PurchasingAreaSmallRepairsAmountSet')({
              purchasingAreaId: input.command.purchasingAreaId,
              smallRepairsAmountPence: input.command.smallRepairsAmount,
              actor: input.command.actor,
            })
          )
    )
  );

export const setSmallRepairsAmount: Command<SetSmallRepairsAmount> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
