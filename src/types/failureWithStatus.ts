import {StatusCodes} from 'http-status-codes';

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
