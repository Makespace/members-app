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
  smallPurchaseAmount: PositivePenceFromPoundsString,
});

type SetSmallPurchaseAmount = t.TypeOf<typeof codec>;

// How much a single budget purchase can cost before it needs a proposal.
// Only requests made after the change are affected: each request's outcome
// was worked out, and recorded, when it was made.
const process: Command<SetSmallPurchaseAmount>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.smallPurchaseAmountPence ===
      input.command.smallPurchaseAmount
        ? O.none
        : O.some(
            constructEvent('PurchasingAreaSmallPurchaseAmountSet')({
              purchasingAreaId: input.command.purchasingAreaId,
              smallPurchaseAmountPence: input.command.smallPurchaseAmount,
              actor: input.command.actor,
            })
          )
    )
  );

export const setSmallPurchaseAmount: Command<SetSmallPurchaseAmount> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
