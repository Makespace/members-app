import {Logger} from 'pino';
import {Failure, Email, DomainEvent, ResourceVersion} from './types';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import {FailureWithStatus} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

import {Resource} from './types/resource';
import {EventName, EventOfType} from './types/domain-event';
import {SharedReadModel} from './read-models/shared-state';

export type GoogleSheetId = string;

// Future scans of the sheet should start at this row + 1 if set otherwise scan the entire sheet.
export type LastGoogleSheetRowRead = O.Option<number>;

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
  getCachedSheetData: (sheetId: string) => TE.TaskEither<
    FailureWithStatus,
    O.Option<{
      cached_at: Date;
      last_row_read: LastGoogleSheetRowRead;
      cached_data: t.Validation<
        ReadonlyArray<
          | EventOfType<'EquipmentTrainingQuizResult'>
          | EventOfType<'EquipmentTrainingQuizSync'>
        >
      >;
    }>
  >;
  cacheSheetData: (
    cacheTimestamp: Date,
    sheetId: GoogleSheetId,
    logger: Logger,
    last_row_read: LastGoogleSheetRowRead,
    data: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizSync'>
      | EventOfType<'EquipmentTrainingQuizResult'>
    >
  ) => Promise<void>;
  getCachedTroubleTicketData: (sheetId: string) => TE.TaskEither<
    FailureWithStatus,
    O.Option<{
      cached_at: Date;
      last_row_read: LastGoogleSheetRowRead;
      cached_data: t.Validation<
        ReadonlyArray<EventOfType<'TroubleTicketResponseSubmitted'>>
      >;
    }>
  >;
  cacheTroubleTicketData: (
    cacheTimestamp: Date,
    sheetId: GoogleSheetId,
    logger: Logger,
    last_row_read: LastGoogleSheetRowRead,
    data: ReadonlyArray<EventOfType<'TroubleTicketResponseSubmitted'>>
  ) => Promise<void>;
};
