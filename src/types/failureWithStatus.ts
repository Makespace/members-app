import {flow} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';

export type FailureWithStatus = {
  status: StatusCodes;
  message: string;
  payload?: unknown;
};

export const failureWithStatus =
  (message: string, status: StatusCodes) =>
  (payload?: unknown): FailureWithStatus => ({
    status,
    message,
    payload,
  });

export const toCodecFailure = (message: string) =>
  flow(
    formatValidationErrors,
    failureWithStatus(message, StatusCodes.INTERNAL_SERVER_ERROR)
  );
