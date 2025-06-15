import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';

import {Dependencies} from '../../dependencies';
import {SheetDataTable} from '../../sync-worker/google/sheet-data-table';
import {pipe} from 'fp-ts/lib/function';
import {allMemberNumbers, TrainedMember} from '../shared-state/return-types';

export type EquipmentQuizResults = {
  sheetData: SheetDataTable['rows'];
  passedQuizes: SheetDataTable['rows'];
  failedQuizes: SheetDataTable['rows'];
  lastQuizSync: O.Option<Date>;
};

export const extractPassedQuizes = (
  sheetData: SheetDataTable['rows']
): SheetDataTable['rows'] =>
  pipe(
    sheetData,
    RA.filter(row => row.percentage === 100)
  );

export const extractFailedQuizes = (
  sheetData: SheetDataTable['rows']
): SheetDataTable['rows'] =>
  pipe(
    sheetData,
    RA.filter(row => row.percentage < 100)
  );

export const getQuizResults = (deps: Dependencies) => {
  // const cache = {};
  return (
    sheetId: string,
    skip: ReadonlyArray<TrainedMember>
  ): TE.TaskEither<string, EquipmentQuizResults> => {
    return pipe(
      TE.Do,
      TE.apS('lastQuizSync', deps.lastQuizSync(sheetId)),
      TE.bind('sheetData', () =>
        deps.getSheetData(
          sheetId,
          skip.flatMap(allMemberNumbers),
          skip.map(m => m.emailAddress)
        )
      ),
      TE.let('passedQuizes', ({sheetData}) => extractPassedQuizes(sheetData)),
      TE.let('failedQuizes', ({sheetData}) => extractFailedQuizes(sheetData))
    );
  };
};
