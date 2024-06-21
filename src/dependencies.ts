import {Logger} from 'pino';
import {Failure, Email, DomainEvent} from './types';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

import {Resource} from './types/resource';
import {EventName, EventOfType} from './types/domain-event';
import {sheets_v4} from 'googleapis';

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
  getAllEventsByType: <T extends EventName>(
    eventType: T
  ) => TE.TaskEither<FailureWithStatus, ReadonlyArray<EventOfType<T>>>;
  getResourceEvents: (resource: Resource) => TE.TaskEither<
    FailureWithStatus,
    {
      events: ReadonlyArray<DomainEvent>;
      version: number;
    }
  >;
  logger: Logger;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
  pullGoogleSheetData: (
    logger: Logger,
    trainingSheetId: string
  ) => TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet>;
};
