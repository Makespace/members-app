import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';

import {Dependencies} from '../../dependencies';
import {SheetDataTable} from '../../sync-worker/google/sheet-data-table';
import { FailureWithStatus } from '../../types/failure-with-status';

export type EquipmentQuizResults = {
  passedQuizes: ReadonlyArray<SheetDataTable['rows'][0]>;
  failedQuizes: ReadonlyArray<SheetDataTable['rows'][0]>;
  lastQuizSync: O.Option<Date>;
};

export const getQuizResults = (deps: Dependencies) => {
  const cache = {};
  return (sheetId: string): TE.TaskEither<FailureWithStatus, O.Option<EquipmentQuizResults>> => {
    const data = await deps.lastQuizSync(sheetId)();
    if (E.isLeft(data)) {
      return O.none;
    }
  };
};
