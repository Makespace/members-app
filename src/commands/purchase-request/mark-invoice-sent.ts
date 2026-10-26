import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {canMarkInvoiceSent} from '../../purchasing/permissions';
import {requestAwaitingInvoice} from './decide-helpers';

const codec = t.strict({
  id: tt.UUID,
});

type MarkInvoiceSent = t.TypeOf<typeof codec>;

// Recording that a bought purchase's invoice has been passed on to the
// accountants (however it was sent).
const process: Command<MarkInvoiceSent>['process'] = input =>
  pipe(
    requestAwaitingInvoice(input.rm, input.command.id),
    TE.fromEither,
    TE.map(request =>
      O.some(
        constructEvent('PurchaseRequestInvoiceSent')({
          id: request.id,
          actor: input.command.actor,
        })
      )
    )
  );

export const markInvoiceSent: Command<MarkInvoiceSent> = {
  process,
  decode: codec.decode,
  // Whoever bought it, the area's purchasers and super users.
  isAuthorized: ({actor, rm, input}) =>
    pipe(
      rm.purchasing.getRequest(input.id),
      O.exists(request => canMarkInvoiceSent(rm, actor, request))
    ),
};
