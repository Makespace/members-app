import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {SharedReadModel} from '../../read-models/shared-state';
import {Actor, User} from '../../types';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';
import {canDecide} from '../../purchasing/permissions';
import {PositivePenceFromPoundsString} from '../../types/money';
import {
  PurchaseRequest,
  PurchasingArea,
} from '../../read-models/shared-state/return-types';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';

export const requestPath = (id: tt.UUID) => `/purchase-requests/view/${id}`;

// Where an approve or decline form sends the browser once saved: back to
// the request.
export const decisionAction = (
  verb: 'approve' | 'decline' | 'mark-bought',
  id: tt.UUID
) =>
  `/purchase-requests/${verb}?next=${encodeURIComponent(requestPath(id))}`;

const notFound = () =>
  failureWithStatus('No such purchase request', StatusCodes.NOT_FOUND)();

// A request can be approved or declined once, while it awaits approval.
export const requestAwaitingDecision = (
  rm: SharedReadModel,
  id: tt.UUID
): E.Either<FailureWithStatus, PurchaseRequest> =>
  pipe(
    rm.purchasing.getRequest(id),
    E.fromOption(notFound),
    E.filterOrElse(
      request => request.status === 'awaiting-approval',
      request =>
        failureWithStatus(
          `This purchase request has already been ${request.status}.`,
          StatusCodes.BAD_REQUEST
        )()
    )
  );

export type DecisionViewModel = {
  request: PurchaseRequest;
  purchasingArea: O.Option<PurchasingArea>;
};

// Who can approve or decline the request with this id; see
// src/purchasing/permissions.ts.
export const canDecideById = (rm: SharedReadModel, actor: Actor, id: tt.UUID) =>
  pipe(
    rm.purchasing.getRequest(id),
    O.exists(request => canDecide(rm, actor, request))
  );

// For forms reached as /purchase-requests/<verb>?request=<id>: the request,
// if it's at the stage the form is for and they may act on it.
const fromParams =
  (
    find: (
      rm: SharedReadModel,
      id: tt.UUID
    ) => E.Either<FailureWithStatus, PurchaseRequest>
  ) =>
  (
    rm: SharedReadModel,
    input: unknown,
    user: User
  ): E.Either<FailureWithStatus, DecisionViewModel> =>
  pipe(
    input,
    t.type({request: tt.UUID}).decode,
    E.mapLeft(errors =>
      failureWithStatus(
        'Parameters submitted to the form were invalid',
        StatusCodes.BAD_REQUEST
      )(formatValidationErrors(errors))
    ),
    E.chain(({request}) => find(rm, request)),
    E.filterOrElse(
      request => canDecide(rm, liftActorOrUser(user), request),
      () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.FORBIDDEN
        )()
    ),
    E.map(request => ({
      request,
      purchasingArea: rm.purchasing.get(request.purchasingAreaId, new Date()),
    }))
  );

// Approve and decline; mark as bought. Whoever can do one can do the other
// (see src/purchasing/permissions.ts).
export const decisionFromParams = fromParams((rm, id) =>
  requestAwaitingDecision(rm, id)
);
export const purchaseFromParams = fromParams((rm, id) =>
  requestAwaitingPurchase(rm, id)
);

// What it really cost, if given and different from what was asked; null
// means the requested amount stands.
export const actualCostFrom = (
  given: string | undefined,
  request: PurchaseRequest
): E.Either<FailureWithStatus, number | null> => {
  if (given === undefined || given.trim() === '') {
    return E.right(null);
  }
  return pipe(
    PositivePenceFromPoundsString.decode(given),
    E.bimap(
      () =>
        failureWithStatus(
          'Please give what it cost in pounds, e.g. 42.50.',
          StatusCodes.BAD_REQUEST
        )(),
      pence => (pence === request.totalPence ? null : pence)
    )
  );
};

// A request that has been approved and is waiting to be bought.
export const requestAwaitingPurchase = (
  rm: SharedReadModel,
  id: tt.UUID
): E.Either<FailureWithStatus, PurchaseRequest> =>
  pipe(
    rm.purchasing.getRequest(id),
    E.fromOption(notFound),
    E.filterOrElse(
      request => request.status === 'approved',
      () =>
        failureWithStatus(
          'Only an approved purchase request that has not been bought yet can be marked as bought.',
          StatusCodes.BAD_REQUEST
        )()
    )
  );
