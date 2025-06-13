import {Logger} from 'pino';
import {Client} from '@libsql/client';
import {GoogleHelpers} from './google/pull_sheet_data';
import {pipe} from 'fp-ts/lib/function';
import { SyncWorkerDependencies } from './dependencies';

export const syncTroubleTickets = (
  deps: SyncWorkerDependencies,
  troubleTicketSheetId: string,
): Promise<void> => pipe(
    troubleTicketSheetId,
    

);


if (O.isSome(troubleTicketSheetId)) {
        logger.info('Pulling latest trouble ticket reports...');
        if (
          O.isNone(lastTroubleTicketSync) ||
          lastTroubleTicketSync.value.diffNow() > TROUBLE_TICKET_SYNC_INTERVAL
        ) {
          await startSpan(
            {
              name: 'Trouble Ticket Sync',
              attributes: {
                troubleTicketSheetId: troubleTicketSheetId.value,
              },
            },
            async () => {
              await pullTroubleTicketResponses(
                logger,
                googleHelpers,
                troubleTicketSheetId.value,
                updateState,
                cacheTroubleTicketData
              );
              lastTroubleTicketSync = O.some(DateTime.now());
            }
          );
        } else {
          logger.info(
            '%s since last trouble ticket sync - not resyncing yet',
            lastTroubleTicketSync.value.diffNow().toHuman()
          );
        }
        logger.info('...done');
      }
