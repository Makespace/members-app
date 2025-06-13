import {Logger} from 'pino';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Config} from '../configuration';
import {GoogleHelpers} from './google/pull_sheet_data';
import {SheetDataTable} from './google/sheet-data-table';

export type SheetName = string;
export type RowIndex = number;
export type LastRowRead = Record<SheetName, RowIndex>;

export interface SyncWorkerDependencies {
  conf: Config;
  logger: Logger;
  google: O.Option<GoogleHelpers>;
  lastSync: (
    troubleTicketSheetId: string
  ) => TE.TaskEither<string, O.Option<Date>>;
  storeSync: (
    troubleTicketSheetId: string,
    date: Date
  ) => TE.TaskEither<string, void>;
  storeRowsRead: (
    data: ReadonlyArray<SheetDataTable['rows'][0]>
  ) => TE.TaskEither<string, void>;
  lastRowRead: (
    troubleTicketSheetId: string
  ) => TE.TaskEither<string, LastRowRead>;
}
