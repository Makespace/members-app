import {Client} from '@libsql/client';
import {SyncWorkerDependencies} from '../dependencies';

export const updateTrainingSheetCache =
  (
    googleDB: Client
  ): SyncWorkerDependencies['updateTrainingSheetCache'] =>
  (sheetId, newData) => {

  };
