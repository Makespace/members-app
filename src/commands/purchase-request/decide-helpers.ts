import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {SharedReadModel} from '../../read-models/shared-state';
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
export const decisionAction = (verb: 'approve' | 'decline', id: tt.UUID) =>
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

// For forms reached as /purchase-requests/<verb>?request=<id>.
export const decisionFromParams = (
  rm: SharedReadModel,
  input: unknown
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
    E.chain(({request}) => requestAwaitingDecision(rm, request)),
    E.map(request => ({
      request,
      purchasingArea: rm.purchasing.get(request.purchasingAreaId, new Date()),
    }))
  );
