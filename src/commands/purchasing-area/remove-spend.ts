import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  // The recorded spending to take back.
  id: tt.UUID,
});

type RemovePurchasingAreaSpend = t.TypeOf<typeof codec>;

// Takes back spending recorded by mistake this year. Already gone (or never
// recorded) is nothing to do.
const process: Command<RemovePurchasingAreaSpend>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.recordedSpend.some(spend => spend.id === input.command.id)
        ? O.some(
            constructEvent('PurchasingAreaSpendRemoved')({
              id: input.command.id,
              actor: input.command.actor,
            })
          )
        : O.none
    )
  );

export const removeSpend: Command<RemovePurchasingAreaSpend> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
