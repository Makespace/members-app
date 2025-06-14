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
import {Client} from '@libsql/client';
import {UUID} from 'io-ts-types';

export type SheetName = string;
export type RowIndex = number;
export type LastRowRead = ReadonlyRecord<SheetName, RowIndex>;

export interface SyncWorkerDependencies {
  conf: Config;
  logger: Logger;
  google: O.Option<GoogleHelpers>;
  db: Client;
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
}
