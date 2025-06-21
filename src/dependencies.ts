import {Logger} from 'pino';
import {Failure, Email, DomainEvent, ResourceVersion} from './types';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {FailureWithStatus} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

import {Resource} from './types/resource';
import {EventName, EventOfType} from './types/domain-event';
import {SharedReadModel} from './read-models/shared-state';
import {
  SheetDataTable,
  TroubleTicketDataTable,
} from './sync-worker/google/sheet-data-table';

export type Dependencies = {
  commitEvent: (
    resource: Resource,
    lastKnownVersion: ResourceVersion
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
      version: ResourceVersion;
    }
  >;
  sharedReadModel: SharedReadModel;
  logger: Logger;
  rateLimitSendingOfEmails: (email: Email) => TE.TaskEither<Failure, Email>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
  lastQuizSync: (sheetId: string) => TE.TaskEither<string, O.Option<Date>>;
  getSheetData: (
    sheetId: string
  ) => TE.TaskEither<string, SheetDataTable['rows']>;
  getTroubleTicketData: () => TE.TaskEither<
    string,
    O.Option<TroubleTicketDataTable['rows']>
  >;

  // getPassedQuizResults: (
  //   sheetId: string,
  //   skip_member_numbers: ReadonlyArray<number>,
  //   skip_emails: ReadonlyArray<string>
  // ) => TE.TaskEither<string, SheetDataTable['rows']>;
  // getFailedQuizResults: (
  //   sheetId: string,
  //   skip_member_numbers: ReadonlyArray<number>,
  //   skip_emails: ReadonlyArray<string>,
  //   count: number
  // ) => TE.TaskEither<string, SheetDataTable['rows']>;
};
