import {and, desc, eq, gt} from 'drizzle-orm';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {
  TroubleTicketDataTable,
  troubleTicketDataTable,
} from '../google/sheet-data-table';
import {ExternalStateDB} from '../external-state-db';

export const getTroubleTicketData =
  (extDB: ExternalStateDB, sheetId: O.Option<string>) =>
  (
    from: O.Option<Date>
  ): TE.TaskEither<string, O.Option<TroubleTicketDataTable['rows']>> => {
    if (O.isNone(sheetId)) {
      return TE.right(O.none);
    }
    return pipe(
      TE.tryCatch(
        () =>
          extDB
            .select()
            .from(troubleTicketDataTable)
            .where(
              and(
                eq(troubleTicketDataTable.sheet_id, sheetId.value),
                gt(
                  troubleTicketDataTable.response_submitted,
                  O.getOrElse(() => new Date(0))(from)
                )
              )
            )
            .orderBy(desc(troubleTicketDataTable.response_submitted)),
        reason =>
          `Failed to get trouble sheet data from  '${sheetId.value}': ${(reason as Error).message}`
      ),
      TE.map(O.some)
    );
  };
