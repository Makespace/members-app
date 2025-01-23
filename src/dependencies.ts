import {Logger} from 'pino';
import {Failure, Email, DomainEvent, ResourceVersion} from './types';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from './types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

import {Resource} from './types/resource';
import {EventName, EventOfType} from './types/domain-event';
import {SharedReadModel} from './read-models/shared-state';

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
  getCachedSheetData: () => TE.TaskEither<
    FailureWithStatus,
    ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>
  >;
  cacheSheetData: (
    data: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>
  ) => TE.TaskEither<FailureWithStatus, void>;
};
