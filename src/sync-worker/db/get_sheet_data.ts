import {and, eq, gt} from 'drizzle-orm';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {SheetDataTable, sheetDataTable} from '../google/sheet-data-table';
import {GoogleDB} from '../google/db';

export const getSheetData =
  (googleDB: GoogleDB) =>
  (
    sheetId: string,
    from: O.Option<Date>
  ): TE.TaskEither<string, SheetDataTable['rows']> =>
    pipe(
      TE.tryCatch(
        () =>
          O.isSome(from)
            ? googleDB
                .select()
                .from(sheetDataTable)
                .where(
                  and(
                    eq(sheetDataTable.sheet_id, sheetId),
                    gt(sheetDataTable.response_submitted, from.value)
                  )
                )
            : googleDB
                .select()
                .from(sheetDataTable)
                .where(eq(sheetDataTable.sheet_id, sheetId)),
        reason =>
          `Failed to get sheet data for sheet '${sheetId}': ${(reason as Error).message}`
      )
    );

export const getSheetDataByMemberNumber =
  (googleDB: GoogleDB) =>
  (
    memberNumber: number,
  ): TE.TaskEither<string, SheetDataTable['rows']> =>
    pipe(
      TE.tryCatch(
        () =>
          googleDB
            .select()
            .from(sheetDataTable)
            .where(eq(sheetDataTable.member_number_provided, memberNumber)),
        reason =>
          `Failed to get sheet data for memberNumber '${memberNumber}': ${(reason as Error).message}`
      )
    );
