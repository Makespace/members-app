import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {canMarkBought} from '../../purchasing/permissions';
import {actualCostFrom, requestAwaitingPurchase} from './decide-helpers';

const codec = t.strict({
  id: tt.UUID,
  // What it really cost, in pounds; blank keeps what was asked for.
  actualCost: t.union([t.string, t.undefined]),
});

type MarkPurchaseRequestBought = t.TypeOf<typeof codec>;

// Recording that an approved request has been bought, e.g. by a purchaser
// after a director approved it.
const process: Command<MarkPurchaseRequestBought>['process'] = input =>
  pipe(
    requestAwaitingPurchase(input.rm, input.command.id),
    E.bindTo('request'),
    E.bind('actualCostPence', ({request}) =>
      actualCostFrom(input.command.actualCost, request)
    ),
    TE.fromEither,
    TE.map(({request, actualCostPence}) =>
      O.some(
        constructEvent('PurchaseRequestBought')({
          id: request.id,
          actualCostPence,
          actor: input.command.actor,
        })
      )
    )
  );

export const markBought: Command<MarkPurchaseRequestBought> = {
  process,
  decode: codec.decode,
  // Who can approve it can buy it; see src/purchasing/permissions.ts.
  isAuthorized: ({actor, rm, input}) =>
    pipe(
      rm.purchasing.getRequest(input.id),
      O.exists(request => canMarkBought(rm, actor, request))
    ),
};
