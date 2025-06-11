import {Logger} from 'pino';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';

import {GoogleHelpers} from '../../../init-dependencies/google/pull_sheet_data';

import {Dependencies} from '../../../dependencies';

import {startSpan} from '@sentry/node';

import {asyncApplyTrainingSheetEvents} from './training-sheet';
import {asyncApplyTroubleTicketEvents} from './trouble-tickets';

export async function asyncApplyGoogleEvents(
  logger: Logger,
  currentState: BetterSQLite3Database,
  googleHelpers: GoogleHelpers,
  updateState: (event: DomainEvent) => void,
  googleRefreshIntervalMs: number,
  troubleTicketSheetId: O.Option<string>,
  cacheSheetData: Dependencies['cacheSheetData'],
  cacheTroubleTicketData: Dependencies['cacheTroubleTicketData']
) {
  await startSpan(
    {
      name: 'Apply Google Events',
    },
    async () => {
      await asyncApplyTroubleTicketEvents(
        logger,
        googleHelpers,
        troubleTicketSheetId,
        updateState,
        cacheTroubleTicketData
      );
      await asyncApplyTrainingSheetEvents(
        logger,
        currentState,
        googleHelpers,
        updateState,
        googleRefreshIntervalMs,
        cacheSheetData
      );
    }
  );
}
