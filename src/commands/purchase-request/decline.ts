import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {limitedText, REASON_MAX} from '../../types/limited-text';
import {canDecideById, requestAwaitingDecision} from './decide-helpers';

const codec = t.strict({
  id: tt.UUID,
  // Shown to whoever sent the request.
  reason: limitedText(REASON_MAX),
});

type DeclinePurchaseRequest = t.TypeOf<typeof codec>;

// Turning a request down, saying why. Only super users.
const process: Command<DeclinePurchaseRequest>['process'] = input =>
  pipe(
    requestAwaitingDecision(input.rm, input.command.id),
    TE.fromEither,
    TE.map(request =>
      O.some(
        constructEvent('PurchaseRequestDeclined')({
          id: request.id,
          reason: input.command.reason.trim(),
          actor: input.command.actor,
        })
      )
    )
  );

export const decline: Command<DeclinePurchaseRequest> = {
  process,
  decode: codec.decode,
  // A purchaser of its area when it needs no proposal; otherwise a super
  // user. See src/purchasing/permissions.ts.
  isAuthorized: ({actor, rm, input}) => canDecideById(rm, actor, input.id),
};
