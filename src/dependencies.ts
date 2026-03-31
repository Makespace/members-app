import {Logger} from 'pino';
import {
  DeletedEvent,
  Failure,
  Email,
  DomainEvent,
  ResourceVersion,
  StoredDomainEvent,
  StoredDomainEventWithDeletion,
  StoredEventOfType,
} from './types';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {FailureWithStatus} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

import {Resource} from './types/resource';
import {EventName} from './types/domain-event';
import {SharedReadModel} from './read-models/shared-state';
import {
  SheetDataTable,
  TroubleTicketDataTable,
} from './sync-worker/google/sheet-data-table';
import {UUID} from 'io-ts-types';
import {Actor} from './types/actor';

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
    ReadonlyArray<StoredDomainEvent>
  >;
  getAllEventsIncludingDeleted: () => TE.TaskEither<
    FailureWithStatus,
    ReadonlyArray<StoredDomainEventWithDeletion>
  >;
  getAllEventsByType: <T extends EventName>(
    eventType: T
  ) => TE.TaskEither<FailureWithStatus, ReadonlyArray<StoredEventOfType<T>>>;
  getDeletedEventById: (
    eventId: UUID
  ) => TE.TaskEither<FailureWithStatus, O.Option<DeletedEvent>>;
  deleteEvent: (
    eventId: UUID,
    deletedBy: Actor,
    reason: string
  ) => TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  >;
  getEventById: (
    eventId: UUID
  ) => TE.TaskEither<FailureWithStatus, O.Option<StoredDomainEvent>>;
  getResourceEvents: (resource: Resource) => TE.TaskEither<
    FailureWithStatus,
    {
      events: ReadonlyArray<StoredDomainEvent>;
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
  getSheetDataByMemberNumber: (
    memberNumber: number,
  ) => TE.TaskEither<string, SheetDataTable['rows']>,
  getTroubleTicketData: (
    from: O.Option<Date>
  ) => TE.TaskEither<string, O.Option<TroubleTicketDataTable['rows']>>;
};
