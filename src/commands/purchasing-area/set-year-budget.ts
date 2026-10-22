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
  // In pounds, e.g. "5000.00"; recorded in pence.
  yearlyBudget: PenceFromPoundsString,
});

type SetPurchasingAreaYearBudget = t.TypeOf<typeof codec>;

// This calendar year's budget only, e.g. an extension; the usual budget
// applies again next year. Setting it to the usual budget undoes it.
const process: Command<SetPurchasingAreaYearBudget>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.yearlyBudgetPence === input.command.yearlyBudget
        ? O.none
        : O.some(
            constructEvent('PurchasingAreaYearBudgetSet')({
              purchasingAreaId: purchasingArea.id,
              budgetYear: purchasingArea.budgetYear,
              yearlyBudgetPence: input.command.yearlyBudget,
              actor: input.command.actor,
            })
          )
    )
  );

export const setYearBudget: Command<SetPurchasingAreaYearBudget> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
