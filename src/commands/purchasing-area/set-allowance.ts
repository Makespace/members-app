import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {PositivePenceFromPoundsString} from '../../types/money';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  // The first budget year it applies to; it carries on until another is set.
  fromBudgetYear: tt.IntFromString,
  // In pounds, e.g. "1000.00"; recorded in pence.
  allowancePerArea: PositivePenceFromPoundsString,
});

type SetAllowance = t.TypeOf<typeof codec>;

// Every Area is allocated the same yearly allowance, and a purchasing area's
// usual budget is its areas' allowances added together. It can change year
// to year, so each is set from a budget year onwards.
const process: Command<SetAllowance>['process'] = input =>
  pipe(
    input.command.fromBudgetYear < 2000 || input.command.fromBudgetYear > 2100
      ? E.left(
          failureWithStatus(
            'Please give a year such as 2026.',
            StatusCodes.BAD_REQUEST
          )()
        )
      : E.right(input.command),
    E.map(({fromBudgetYear, allowancePerArea}) =>
      pipe(
        input.rm.purchasing.allowances(),
        found => found.find(allowance => allowance.fromBudgetYear === fromBudgetYear),
        existing =>
          existing?.allowancePerAreaPence === allowancePerArea
            ? O.none
            : O.some(
                constructEvent('PurchasingAllowanceSet')({
                  fromBudgetYear,
                  allowancePerAreaPence: allowancePerArea,
                  actor: input.command.actor,
                })
              )
      )
    ),
    TE.fromEither
  );

export const setAllowance: Command<SetAllowance> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
