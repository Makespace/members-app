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
import {Email, Failure, ResourceVersion, StoredDomainEvent} from '../types';
import {SharedReadModel} from '../read-models/shared-state';
import {Resource} from '../types/resource';
import {Dependencies} from '../dependencies';
import {FailureWithStatus} from '../types/failure-with-status';

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
  updateTrainingSheetCache: (
    sheetId: string,
    data: SheetDataTable['rows']
  ) => TE.TaskEither<string, void>;
  updateTroubleTicketCache: (
    data: TroubleTicketDataTable['rows']
  ) => TE.TaskEither<string, void>;
  getTrainingSheetsToSync: () => TE.TaskEither<
    string,
    ReadonlyMap<UUID, string>
  >;
  ensureGoogleDBTablesExist: () => Promise<void>;
  commitEvent: Dependencies['commitEvent'];
  sendEmail: (email: Email) => TE.TaskEither<Failure, string>;
  lastQuizSync: Dependencies['lastQuizSync'];
  getSheetData: Dependencies['getSheetData'];
  getResourceEvents: (resource: Resource) => TE.TaskEither<
    FailureWithStatus,
    {
      events: ReadonlyArray<StoredDomainEvent>;
      version: ResourceVersion;
    }
  >;
}
