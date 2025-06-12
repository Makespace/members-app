import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {DomainEvent} from '../../../types';

import {constructEvent, EventOfType} from '../../../types/domain-event';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
} from '../../../init-dependencies/google/pull_sheet_data';

import {Dependencies} from '../../../dependencies';

import {getChunkIndexes} from '../../../util';
import {formatValidationErrors} from 'io-ts-reporters';
import {DateTime, Duration} from 'luxon';
import {pipe} from 'fp-ts/lib/function';
import {extractTimestamp, grabColumn} from './util';
import {startSpan} from '@sentry/node';
import {LastGoogleSheetRowRead} from '../../shared-state/return-types';
import * as R from 'fp-ts/Record';

const ROW_BATCH_SIZE = 50;
const TROUBLE_TICKET_SYNC_INTERVAL = Duration.fromMillis(1000 * 60 * 20);
const EXPECTED_TROUBLE_TICKET_RESPONSE_SHEET_NAME = 'Form Responses 1';

// FIXME - Remove global state, Temporary for POC.
let lastTroubleTicketSync: O.Option<DateTime> = O.none;
let lastRowRead: LastGoogleSheetRowRead = {};

const extractTroubleTicketResponseRows = (
  logger: Logger,
  data: GoogleSpreadsheetDataForSheet,
  updateState: (event: EventOfType<'TroubleTicketResponseSubmitted'>) => void,
  timezone: string
) => {
  // FIXME - This is all quite hard coded for the prototype.
  const rows = data.sheets[0]?.data[0]?.rowData;
  if (!rows) {
    return;
  }

  for (const row of rows) {
    if ('values' in row) {
      const _grabColumn = grabColumn(row.values);
      const timestamp = _grabColumn(0, extractTimestamp(timezone).decode);
      const email_address = _grabColumn(1, t.union([t.string, t.null]).decode);
      const which_equipment = _grabColumn(
        2,
        t.union([t.string, t.null]).decode
      );
      const name = _grabColumn(8, t.union([t.string, t.null]).decode);
      const membership_number = _grabColumn(
        9,
        t.union([t.Int, tt.IntFromString, t.null]).decode
      );

      const validationErr = (column: string, err: t.Errors) => {
        logger.warn(
          `Failed to parse trouble ticket row (column ${column}), skipping: ${formatValidationErrors(err).join(',')}`
        );
      };

      const grabOtherResponse = (i: number) =>
        pipe(
          _grabColumn(i, t.string.decode),
          E.getOrElseW(err => {
            logger.warn(
              `Failed to parse trouble ticket column ${i} - defaulting to empty: ${formatValidationErrors(err).join(',')}`
            );
            return '';
          })
        );

      const responses = {
        ['If you answered "Other" above or an ABS or PLA 3d printer, please tell us which one. (printers are numbered from the left']:
          grabOtherResponse(3),
        ["What's the status of the machine?"]: grabOtherResponse(4),
        ['What were you attempting to do with the machine? Please include details about material or file type and what you expected to happen.']:
          grabOtherResponse(5),
        ['What error or issue did you encounter.  Please include events and observations about what actually happened.']:
          grabOtherResponse(6),
        ['What steps did you take before encountering the error.  Please include any relevant settings or changes made prior to the error.']:
          grabOtherResponse(7),
      };

      if (E.isLeft(timestamp)) {
        validationErr('timestamp', timestamp.left);
        continue;
      }
      if (E.isLeft(email_address)) {
        validationErr('timestamp', email_address.left);
        continue;
      }
      if (E.isLeft(which_equipment)) {
        validationErr('timestamp', which_equipment.left);
        continue;
      }
      if (E.isLeft(name)) {
        validationErr('timestamp', name.left);
        continue;
      }
      if (E.isLeft(membership_number)) {
        validationErr('timestamp', membership_number.left);
        continue;
      }

      updateState(
        constructEvent('TroubleTicketResponseSubmitted')({
          response_submitted_epoch_ms: timestamp.right,
          email_address: email_address.right,
          which_equipment: which_equipment.right,
          submitter_name: name.right,
          submitter_membership_number: membership_number.right,
          submitted_response: responses,
        })
      );
    }
  }
};

export const pullTroubleTicketResponses = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  troubleTicketSheetId: string,
  prevLastRowRead: Readonly<LastGoogleSheetRowRead>,
  collectEvents: (event: EventOfType<'TroubleTicketResponseSubmitted'>) => void
): Promise<Readonly<LastGoogleSheetRowRead>> => {
  logger.info('Getting trouble ticket response sheet metadata...');
  const initialMeta = await googleHelpers.pullGoogleSheetDataMetadata(
    logger,
    troubleTicketSheetId
  )();
  if (E.isLeft(initialMeta)) {
    logger.error(
      `Failed to get trouble ticket response sheet metadata. Not continuing: ${initialMeta.left}`
    );
    return prevLastRowRead;
  }

  const newLastRowRead: LastGoogleSheetRowRead = JSON.parse(
    JSON.stringify(prevLastRowRead)
  ) as LastGoogleSheetRowRead;
  if (!newLastRowRead[troubleTicketSheetId]) {
    newLastRowRead[troubleTicketSheetId] = {};
  }

  for (const sheet of initialMeta.right.sheets) {
    if (
      sheet.properties.title === EXPECTED_TROUBLE_TICKET_RESPONSE_SHEET_NAME
    ) {
      const prevLastRowReadForSheet = pipe(
        prevLastRowRead,
        R.lookup(troubleTicketSheetId),
        O.flatMap(R.lookup(sheet.properties.title))
      );

      const startRow = O.getOrElse(() => 1)(prevLastRowReadForSheet) + 1; // 1-indexed and first row is headers.

      logger.info(
        'Found trouble tickets sheet %s, pulling data in batches starting at row %s...',
        sheet.properties.title,
        startRow
      );
      for (const [rowStart, rowEnd] of getChunkIndexes(
        startRow,
        sheet.properties.gridProperties.rowCount,
        ROW_BATCH_SIZE
      )) {
        logger.debug('Pulling trouble tickets rows %s to %s', rowStart, rowEnd);
        const [minCol, maxCol] = [0, 10]; // FIXME - Determine this dynamically.
        const data = await googleHelpers.pullGoogleSheetData(
          logger,
          troubleTicketSheetId,
          sheet.properties.title,
          rowStart,
          rowEnd,
          minCol,
          maxCol
        )();
        if (E.isLeft(data)) {
          logger.error(
            data.left,
            'Failed to pull data for trouble ticket responses rows %s to %s, skipping rest of sheet',
            rowStart,
            rowEnd
          );
          newLastRowRead[troubleTicketSheetId][sheet.properties.title] =
            rowStart - 1;
          return newLastRowRead; // Note we return early without checking more sheets.
        }
        logger.info('Pulled data from google, extracting...');
        extractTroubleTicketResponseRows(
          logger,
          data.right,
          collectEvents,
          initialMeta.right.properties.timeZone
        );
      }
      newLastRowRead[troubleTicketSheetId][sheet.properties.title] =
        sheet.properties.gridProperties.rowCount - 1;
    }
  }
  return newLastRowRead;
};

export async function asyncApplyTroubleTicketEvents(
  logger: Logger,
  googleHelpers: GoogleHelpers,
  troubleTicketSheetId: O.Option<string>,
  updateState: (event: DomainEvent) => void,
  cacheTroubleTicketData: Dependencies['cacheTroubleTicketData']
) {
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
          const events: EventOfType<'TroubleTicketResponseSubmitted'>[] = [];
          const collectEvents = (
            event: EventOfType<'TroubleTicketResponseSubmitted'>
          ) => {
            events.push(event);
            updateState(event);
          };

          const newLastRowRead = await pullTroubleTicketResponses(
            logger,
            googleHelpers,
            troubleTicketSheetId.value,
            lastRowRead,
            collectEvents
          );
          lastTroubleTicketSync = O.some(DateTime.now());
          lastRowRead = newLastRowRead;

          logger.info(
            'Found %s trouble ticket response events %o, caching...',
            lastRowRead,
            events.length
          );
          await cacheTroubleTicketData(
            new Date(),
            troubleTicketSheetId.value,
            logger,
            newLastRowRead,
            events
          );
          logger.info('Finished caching trouble ticket response events');
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
}
