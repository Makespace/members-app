import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {PenceFromPoundsString} from '../../types/money';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  // This budget year or next: an extension can be recorded ahead of the
  // year it's for, once the directors approve it.
  budgetYear: tt.IntFromString,
  // In pounds, e.g. "500.00"; recorded in pence. 0 removes it.
  extension: PenceFromPoundsString,
});

type SetExtension = t.TypeOf<typeof codec>;

// An extension to a purchasing area's yearly allowance for one year: added
// on top of its usual budget, so it still holds if its areas change.
const process: Command<SetExtension>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.chainEitherK(purchasingArea => {
      const {budgetYear, extension} = input.command;
      const current =
        budgetYear === purchasingArea.budgetYear
          ? O.some(purchasingArea.extensionPence)
          : budgetYear === purchasingArea.budgetYear + 1
            ? O.some(purchasingArea.nextYearExtensionPence)
            : O.none;
      return pipe(
        current,
        E.fromOption(() =>
          failureWithStatus(
            `An extension can be set for ${purchasingArea.budgetYear} or ${purchasingArea.budgetYear + 1}.`,
            StatusCodes.BAD_REQUEST
          )()
        ),
        E.map(already =>
          already === extension
            ? O.none
            : O.some(
                constructEvent('PurchasingAreaExtensionSet')({
                  purchasingAreaId: purchasingArea.id,
                  budgetYear,
                  extensionPence: extension,
                  actor: input.command.actor,
                })
              )
        )
      );
    })
  );

export const setExtension: Command<SetExtension> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
