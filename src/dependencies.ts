import {Logger} from 'pino';
import {
  DeletedStoredDomainEvent,
  Failure,
  Email,
  DomainEvent,
  StoredDomainEvent,
  StoredEventOfType,
} from './types';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {FailureWithStatus} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

import {EventName} from './types/domain-event';
import {SharedReadModel} from './read-models/shared-state';
import {
  SheetDataTable,
  TroubleTicketDataTable,
} from './sync-worker/google/sheet-data-table';
import { Int } from 'io-ts';
import { ExternalStateDB } from './sync-worker/external-state-db';

export type Dependencies = {
  commitEvent: (
    lastSeenEventIndex: Int,
  ) => (
    event: DomainEvent,
  ) => TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  >;
  getAllEvents: () => TE.TaskEither<
    FailureWithStatus,
    ReadonlyArray<StoredDomainEvent>
  >;
  getEventByIndex: (eventIndex: Int) => TE.TaskEither<FailureWithStatus, O.Option<StoredDomainEvent>>; 
  getDeletedEvents: () => TE.TaskEither<
    FailureWithStatus,
    ReadonlyArray<DeletedStoredDomainEvent>
  >;
  getDeletedEventByIndex: (eventIndex: Int) => TE.TaskEither<FailureWithStatus, O.Option<DeletedStoredDomainEvent>>;
  getAllEventsByType: <T extends EventName>(
    eventType: T
  ) => TE.TaskEither<FailureWithStatus, ReadonlyArray<StoredEventOfType<T>>>;
  deleteEvent: (
    eventIndex: Int,
    deleteReason: string,
    markDeletedByMemberNumber: Int,
  ) => TE.TaskEither<FailureWithStatus, void>;
  unDeleteEvent: (eventIndex: Int) => TE.TaskEither<FailureWithStatus, void>;
  sharedReadModel: SharedReadModel;
  extDB: ExternalStateDB;
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
