import {Logger} from 'pino';
import {Failure, Email, DomainEvent} from './types';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from './types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {Resource} from './types/resource';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';

export type Dependencies = {
  commitEvent: (
    resource: Resource,
    lastKnownVersion: number
  ) => (
    event: DomainEvent
  ) => TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  >;
  getAllEvents: () => TE.TaskEither<
    FailureWithStatus,
    ReadonlyArray<DomainEvent>
  >;
  getResourceEvents: (resource: Resource) => TE.TaskEither<
    FailureWithStatus,
    {
      events: ReadonlyArray<DomainEvent>;
      version: number;
    }
  >;
  getAllResourceEvents: (resource_type: Resource['type']) => TE.TaskEither<
    FailureWithStatus,
    {
      events: ReadonlyArray<DomainEvent>;
      versions: ReadonlyRecord<string, number>;
    }
  >;
  logger: Logger;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
};
