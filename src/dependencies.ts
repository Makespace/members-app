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
import {MeetupEventRow} from './sync-worker/db/get-meetup-events';

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
    sheetId: string,
    from: O.Option<Date>
  ) => TE.TaskEither<string, SheetDataTable['rows']>;
  getTroubleTicketData: (
    from: O.Option<Date>
  ) => TE.TaskEither<string, O.Option<TroubleTicketDataTable['rows']>>;
  getMeetupEvents: () => TE.TaskEither<string, ReadonlyArray<MeetupEventRow>>;
};
