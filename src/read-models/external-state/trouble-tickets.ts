import * as TE from 'fp-ts/TaskEither';
import {TroubleTicketDataTable} from '../../sync-worker/google/sheet-data-table';
import {Dependencies} from '../../dependencies';

export type TroubleTickets = TroubleTicketDataTable['rows'];

export const getFullQuizResults = (
  deps: Dependencies,
  sheetId: string
): TE.TaskEither<string, TroubleTickets> => deps.getTroubleTicketData(sheetId);
