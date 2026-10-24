import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {REASON_MAX} from '../../types/limited-text';
import {Command} from '../command';
import {
  actualCostFrom,
  canDecideById,
  requestAwaitingDecision,
} from './decide-helpers';

const codec = t.strict({
  id: tt.UUID,
  // What was agreed, e.g. at the owners' forum; told to everyone who heard
  // about the request.
  note: t.union([t.string, t.undefined]),
  // "Approve and mark as bought": they've already bought it.
  markBought: t.union([t.boolean, tt.BooleanFromString, t.undefined]),
  // What it really cost, in pounds, when marking it bought.
  actualCost: t.union([t.string, t.undefined]),
});

type ApprovePurchaseRequest = t.TypeOf<typeof codec>;

const fail = (message: string) =>
  failureWithStatus(message, StatusCodes.BAD_REQUEST)();

// Approving lets the purchase go ahead, and from then it counts against its
// purchasing area's budget. Director approval needs a note saying what was
// agreed; purchaser approval may have one.
const process: Command<ApprovePurchaseRequest>['process'] = input =>
  pipe(
    requestAwaitingDecision(input.rm, input.command.id),
    E.chain(request => {
      const note = (input.command.note ?? '').trim();
      if (note.length > REASON_MAX) {
        return E.left(fail(`Please keep the note to ${REASON_MAX} characters.`));
      }
      if (request.approval === 'proposal' && note === '') {
        return E.left(fail('Please add a note saying what was agreed.'));
      }
      return E.right({request, note: note === '' ? null : note});
    }),
    E.bind('actualCostPence', ({request}) =>
      input.command.markBought === true
        ? actualCostFrom(input.command.actualCost, request)
        : E.right(null)
    ),
    TE.fromEither,
    TE.map(({request, note, actualCostPence}) =>
      O.some(
        constructEvent('PurchaseRequestApproved')({
          id: request.id,
          note,
          alsoBought: input.command.markBought === true,
          actualCostPence,
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
