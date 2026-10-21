import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {PenceFromPoundsString} from '../../types/money';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  // In pounds, e.g. "1500.00"; recorded in pence.
  yearlyBudget: PenceFromPoundsString,
});

type SetPurchasingAreaBudget = t.TypeOf<typeof codec>;

// The usual budget, for every calendar year that hasn't had its own set
// (see set-year-budget.ts). Changing it mid-year changes what is left for the
// rest of this year, unless this year has its own budget.
const process: Command<SetPurchasingAreaBudget>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.usualBudgetPence === input.command.yearlyBudget
        ? O.none
        : O.some(
            constructEvent('PurchasingAreaBudgetSet')({
              purchasingAreaId: input.command.purchasingAreaId,
              yearlyBudgetPence: input.command.yearlyBudget,
              actor: input.command.actor,
            })
          )
    )
  );

export const setBudget: Command<SetPurchasingAreaBudget> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
