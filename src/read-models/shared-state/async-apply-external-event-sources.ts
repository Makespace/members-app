import {Logger} from 'pino';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';

import {GoogleHelpers} from '../../init-dependencies/google/pull_sheet_data';

import {Dependencies} from '../../dependencies';

import {startSpan} from '@sentry/node';
import {asyncApplyRecurlyEvents} from '../external-event-sources/recurly';
import {asyncApplyGoogleEvents} from '../external-event-sources/google/google';

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  googleHelpers: O.Option<GoogleHelpers>,
  updateState: (event: DomainEvent) => void,
  googleRefreshIntervalMs: number,
  troubleTicketSheetId: O.Option<string>,
  cacheSheetData: Dependencies['cacheSheetData'],
  cacheTroubleTicketData: Dependencies['cacheTroubleTicketData'],
  recurlyToken: O.Option<string>
) => {
  return () => () =>
    startSpan(
      {
        name: 'Async Apply External Event Sources',
      },
      async () => {
        logger.info('Applying external event sources...');

        if (O.isNone(googleHelpers)) {
          logger.info('Google external event source disabled');
        } else {
          await asyncApplyGoogleEvents(
            logger,
            currentState,
            googleHelpers.value,
            updateState,
            googleRefreshIntervalMs,
            troubleTicketSheetId,
            cacheSheetData,
            cacheTroubleTicketData
          );
        }

        if (O.isNone(recurlyToken)) {
          logger.info('Recurly external event source disabled');
        } else {
          await asyncApplyRecurlyEvents(
            logger,
            currentState,
            updateState,
            recurlyToken.value
          );
        }

        logger.info('Finished applying external event sources');
      }
    );
};
