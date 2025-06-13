import { pipe } from 'fp-ts/lib/function';
import { Client } from '@libsql/client';
import {GoogleHelpers} from './google/pull_sheet_data';

export const syncEquipmentTrainingSheets = (
  deps: SyncWorkerDependencies,
): Promise<void> => pipe(

);


