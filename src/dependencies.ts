import {Logger} from 'pino';
import {Failure, Email, DomainEvent} from './types';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from './types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';

export type Dependencies = {
  commitEvent: (
    event: DomainEvent
  ) => TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  >;
  getAllEvents: () => TE.TaskEither<
    FailureWithStatus,
    ReadonlyArray<DomainEvent>
  >;
  logger: Logger;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
};
