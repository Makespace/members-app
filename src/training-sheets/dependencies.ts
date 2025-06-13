import {Logger} from 'pino';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Config} from '../configuration';
import {GoogleHelpers} from './google/pull_sheet_data';

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
}
