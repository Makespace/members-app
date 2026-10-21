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
import {RecordedSpendKindCodec} from '../../types/recorded-spend-kind';

const codec = t.strict({
  // Chosen by the form, so a double submission records it once.
  id: tt.UUID,
  purchasingAreaId: tt.UUID,
  // In pounds, e.g. "3000.00"; recorded in pence.
  amount: PositivePenceFromPoundsString,
  description: tt.NonEmptyString,
  // "budget" for spending out of the yearly budget, "approved" for spending
  // approved outside it (e.g. by the directors).
  kind: RecordedSpendKindCodec,
});

type RecordPurchasingAreaSpend = t.TypeOf<typeof codec>;

// Spending this calendar year that didn't come through a purchase request:
// either out of the yearly budget (e.g. what was spent before requests were
// in the app), or approved outside it (e.g. £1,000 the directors approved to
// fix the extraction), which is listed but doesn't use up the budget.
const process: Command<RecordPurchasingAreaSpend>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.recordedSpend.some(spend => spend.id === input.command.id)
        ? O.none
        : O.some(
            constructEvent('PurchasingAreaSpendRecorded')({
              id: input.command.id,
              purchasingAreaId: purchasingArea.id,
              budgetYear: purchasingArea.budgetYear,
              amountPence: input.command.amount,
              description: input.command.description.trim(),
              kind: input.command.kind,
              actor: input.command.actor,
            })
          )
    )
  );

export const recordSpend: Command<RecordPurchasingAreaSpend> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
