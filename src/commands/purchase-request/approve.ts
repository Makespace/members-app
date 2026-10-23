import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {canDecideById, requestAwaitingDecision} from './decide-helpers';

const codec = t.strict({
  id: tt.UUID,
});

type ApprovePurchaseRequest = t.TypeOf<typeof codec>;

// Approving lets the purchase go ahead, and from then it counts against its
// purchasing area's budget. Only super users (in effect, the directors).
const process: Command<ApprovePurchaseRequest>['process'] = input =>
  pipe(
    requestAwaitingDecision(input.rm, input.command.id),
    TE.fromEither,
    TE.map(request =>
      O.some(
        constructEvent('PurchaseRequestApproved')({
          id: request.id,
          actor: input.command.actor,
        })
      )
    )
  );

export const approve: Command<ApprovePurchaseRequest> = {
  process,
  decode: codec.decode,
  // A purchaser of its area when it needs no proposal; otherwise a super
  // user. See src/purchasing/permissions.ts.
  isAuthorized: ({actor, rm, input}) => canDecideById(rm, actor, input.id),
};
