import {Logger} from 'pino';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Config} from '../configuration';
import {GoogleHelpers} from './google/pull_sheet_data';
import {
  SheetDataTable,
  TroubleTicketDataTable,
} from './google/sheet-data-table';
import {ReadonlyRecord} from 'fp-ts/lib/ReadonlyRecord';
import {UUID} from 'io-ts-types';
import {DomainEvent, Email, Failure, ResourceVersion} from '../types';
import {SharedReadModel} from '../read-models/shared-state';
import {Resource} from '../types/resource';

type SheetName = string;
type RowIndex = number;
type LastRowRead = ReadonlyRecord<SheetName, RowIndex>;

export interface SyncWorkerDependencies {
  conf: Config;
  logger: Logger;
  google: GoogleHelpers;
  sharedReadModel: SharedReadModel; // Unlike for the web worker we update this infrequently when required only.
  lastSync: (sheetId: string) => TE.TaskEither<string, O.Option<Date>>;
  storeSync: (sheetId: string, date: Date) => TE.TaskEither<string, void>;
  storeTrainingSheetRowsRead: (
    data: ReadonlyArray<SheetDataTable['rows'][0]>
  ) => TE.TaskEither<string, void>;
  storeTroubleTicketRowsRead: (
    data: ReadonlyArray<TroubleTicketDataTable['rows'][0]>
  ) => TE.TaskEither<string, void>;
  lastTrainingSheetRowRead: (
    sheetId: string
  ) => TE.TaskEither<string, LastRowRead>;
  lastTroubleTicketRowRead: (
    troubleTicketSheetId: string
  ) => TE.TaskEither<string, LastRowRead>;
  clearTrainingSheetCache: (sheetId: string) => TE.TaskEither<string, void>;
  clearTroubleTicketCache: (
    troubleTicketSheetId: string
  ) => TE.TaskEither<string, void>;
  getTrainingSheetsToSync: () => TE.TaskEither<
    string,
    ReadonlyMap<UUID, string>
  >;
  ensureGoogleDBTablesExist: () => Promise<void>;
  commitEvent: (
    resource: Resource,
    lastKnownVersion: ResourceVersion
  ) => (event: DomainEvent) => TE.TaskEither<string, void>;
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
}
