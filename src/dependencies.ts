import {Logger} from 'pino';
import {
  Failure,
  Email,
  DomainEvent,
  ResourceVersion,
  StoredDomainEvent,
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
import { ExternalStateDB } from './sync-worker/external-state-db';

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
  getAllEventsByType: <T extends EventName>(
    eventType: T
  ) => TE.TaskEither<FailureWithStatus, ReadonlyArray<StoredEventOfType<T>>>;
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
