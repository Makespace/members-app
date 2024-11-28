import {flow} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';

type ApplicationStatusCode =
  | StatusCodes.OK
  | StatusCodes.INTERNAL_SERVER_ERROR
  | StatusCodes.BAD_REQUEST
  | StatusCodes.UNAUTHORIZED
  | StatusCodes.FORBIDDEN
  | StatusCodes.NOT_FOUND
  | StatusCodes.NOT_IMPLEMENTED;

export type FailureWithStatus = {
  status: ApplicationStatusCode;
  message: string;
  payload?: unknown;
};

export const failureWithStatus =
  (message: string, status: ApplicationStatusCode) =>
  (payload?: unknown): FailureWithStatus => ({
    status,
    message,
    payload,
  });

export const internalCodecFailure = (message: string) =>
  flow(
    formatValidationErrors,
    failureWithStatus(message, StatusCodes.INTERNAL_SERVER_ERROR)
  );
