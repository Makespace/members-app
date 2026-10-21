import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {PenceFromPoundsString} from '../../types/money';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  id: tt.UUID,
  name: tt.NonEmptyString,
  // In pounds, e.g. "1500.00"; recorded in pence.
  yearlyBudget: PenceFromPoundsString,
});

type CreatePurchasingArea = t.TypeOf<typeof codec>;

const process: Command<CreatePurchasingArea>['process'] = input =>
  TE.right(
    O.isSome(input.rm.purchasing.get(input.command.id, new Date()))
      ? O.none
      : O.some(
          constructEvent('PurchasingAreaCreated')({
            id: input.command.id,
            name: input.command.name,
            yearlyBudgetPence: input.command.yearlyBudget,
            actor: input.command.actor,
          })
        )
  );

export const create: Command<CreatePurchasingArea> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
