import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {SharedReadModel} from '../../read-models/shared-state';
import {PurchasingArea} from '../../read-models/shared-state/return-types';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';

export const purchasingAreaPath = (id: UUID) => `/purchasing-areas/${id}`;

// Where a purchasing-area form should send the browser once it has saved:
// back to that purchasing area's page.
export const actionReturningTo = (verb: string, id: UUID) =>
  `/purchasing-areas/${verb}?next=${encodeURIComponent(purchasingAreaPath(id))}`;

const notFound = () =>
  failureWithStatus(
    'The requested purchasing area does not exist',
    StatusCodes.NOT_FOUND
  )();

export const getPurchasingAreaOrFail = (
  rm: SharedReadModel,
  purchasingAreaId: UUID
) =>
  pipe(
    rm.purchasing.get(purchasingAreaId, new Date()),
    TE.fromOption(notFound)
  );

export const invalidParameters = flow(
  formatValidationErrors,
  failureWithStatus(
    'Parameters submitted to the form were invalid',
    StatusCodes.BAD_REQUEST
  )
);

// For forms reached as /purchasing-areas/<verb>?purchasingArea=<id>.
export const purchasingAreaFromParams = (
  rm: SharedReadModel,
  input: unknown
): E.Either<FailureWithStatus, PurchasingArea> =>
  pipe(
    input,
    t.type({purchasingArea: UUID}).decode,
    E.mapLeft(invalidParameters),
    E.chain(params =>
      pipe(
        rm.purchasing.get(params.purchasingArea, new Date()),
        E.fromOption(notFound)
      )
    )
  );
