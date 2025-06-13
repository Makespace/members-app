import {Logger} from 'pino';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import recurly from 'recurly';
import {DomainEvent} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {EmailAddressCodec} from '../../types/email-address';

import {constructEvent, EventOfType} from '../../types/domain-event';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
} from '../../init-dependencies/google/pull_sheet_data';

import {getLeastRecentlySyncedEquipment} from './equipment/get';
import {Dependencies} from '../../dependencies';
import {
  extractGoogleSheetMetadata,
  GoogleSheetMetadata,
  MAX_COLUMN_INDEX,
} from '../../google/extract-metadata';
import {
  columnBoundsRequired,
  extractGoogleSheetData,
  shouldPullFromSheet,
} from '../../google/google';
import {getChunkIndexes} from '../../util';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {DateTime, Duration} from 'luxon';
import {pipe} from 'fp-ts/lib/function';
import {extractTimestamp} from '../../google/util';
import {startSpan} from '@sentry/node';

const ROW_BATCH_SIZE = 50;
const EXPECTED_TROUBLE_TICKET_RESPONSE_SHEET_NAME = 'Form Responses 1';
const TROUBLE_TICKET_SYNC_INTERVAL = Duration.fromMillis(1000 * 60 * 20);
const RECURLY_SYNC_INTERVAL = Duration.fromMillis(1000 * 60 * 20);

const pullNewEquipmentQuizResultsForSheet = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipmentId: UUID,
  trainingSheetId: string,
  sheet: GoogleSheetMetadata,
  timezone: string,
  updateState: (event: EventOfType<'EquipmentTrainingQuizResult'>) => void
): Promise<void> => {
  logger = logger.child({sheet_name: sheet.name});
  logger.info('Processing sheet');
  for (const [rowStart, rowEnd] of getChunkIndexes(
    2, // 1-indexed and first row is headers.
    sheet.rowCount,
    ROW_BATCH_SIZE
  )) {
    logger.debug('Pulling data for sheet rows %s to %s', rowStart, rowEnd);

    const [minCol, maxCol] = columnBoundsRequired(sheet);

    const data = await googleHelpers.pullGoogleSheetData(
      logger,
      trainingSheetId,
      sheet.name,
      rowStart,
      rowEnd,
      minCol,
      maxCol
    )();
    if (E.isLeft(data)) {
      logger.error(
        data.left,
        'Failed to pull data for sheet rows %s to %s, skipping rest of sheet',
        rowStart,
        rowEnd
      );
      return;
    }
    logger.info('Pulled data from google, extracting...');
    const result = extractGoogleSheetData(
      logger,
      trainingSheetId,
      equipmentId,
      sheet,
      timezone
    )(data.right);
    logger.info(
      'Google sheet data extracted, updating data with the extracted data...'
    );
    if (O.isSome(result)) {
      result.value.forEach(updateState);
    }
  }
  logger.info('Finished processing sheet');
};

export const pullNewEquipmentQuizResults = async (
  logger: Logger,
  googleHelpers: GoogleHelpers,
  equipmentId: UUID,
  trainingSheetId: string,
  updateState: (
    event:
      | EventOfType<'EquipmentTrainingQuizSync'>
      | EventOfType<'EquipmentTrainingQuizResult'>
  ) => void
): Promise<void> => {
  logger.info('Scanning training sheet. Pulling google sheet data...');

  const initialMeta = await googleHelpers.pullGoogleSheetDataMetadata(
    logger,
    trainingSheetId
  )();
  if (E.isLeft(initialMeta)) {
    logger.warn(initialMeta.left);
    return;
  }

  logger.info('Got meta data for sheet...');

  const sheets: GoogleSheetMetadata[] = [];
  for (const sheet of initialMeta.right.sheets) {
    if (!shouldPullFromSheet(trainingSheetId, sheet)) {
      logger.warn(
        "Skipping sheet '%s' as doesn't match expected for form responses",
        sheet.properties.title
      );
      continue;
    }

    const firstRowData = await googleHelpers.pullGoogleSheetData(
      logger,
      trainingSheetId,
      sheet.properties.title,
      1,
      1,
      0,
      MAX_COLUMN_INDEX
    )();
    if (E.isLeft(firstRowData)) {
      logger.warn(
        'Failed to get google sheet first row data for sheet %s, skipping',
        sheet.properties.title
      );
      continue;
    }

    const meta = extractGoogleSheetMetadata(logger)(sheet, firstRowData.right);
    if (O.isNone(meta)) {
      continue;
    }

    logger.info(
      'Got metadata for sheet: %s: %o',
      sheet.properties.title,
      meta.value
    );
    sheets.push(meta.value);
  }

  for (const sheet of sheets) {
    await pullNewEquipmentQuizResultsForSheet(
      logger,
      googleHelpers,
      equipmentId,
      trainingSheetId,
      sheet,
      initialMeta.right.properties.timeZone,
      updateState
    );
  }

  logger.info(
    'Finished pulling equipment quiz results for all sheets, generating quiz sync event...'
  );

  updateState(
    constructEvent('EquipmentTrainingQuizSync')({
      equipmentId,
    })
  );
};

const grabColumn =
  (values: {formattedValue: string}[]) =>
  <T>(index: number, validator: t.Decode<unknown, T>): t.Validation<T> =>
    pipe(
      values,
      A.lookup(index),
      O.map(val => val.formattedValue),
      O.getOrElse<string | null>(() => null),
      val => validator(val)
    );

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
  updateState: (event: EventOfType<'TroubleTicketResponseSubmitted'>) => void,
  cacheTroubleTicketData: Dependencies['cacheTroubleTicketData']
): Promise<void> => {
  logger.info('Getting trouble ticket response sheet metadata...');
  const initialMeta = await googleHelpers.pullGoogleSheetDataMetadata(
    logger,
    troubleTicketSheetId
  )();
  if (E.isLeft(initialMeta)) {
    logger.error(
      `Failed to get trouble ticket response sheet metadata. Not continuing: ${initialMeta.left}`
    );
    return;
  }

  const events: EventOfType<'TroubleTicketResponseSubmitted'>[] = [];
  const collectEvents = (
    event: EventOfType<'TroubleTicketResponseSubmitted'>
  ) => {
    events.push(event);
    updateState(event);
  };

  for (const sheet of initialMeta.right.sheets) {
    if (
      sheet.properties.title === EXPECTED_TROUBLE_TICKET_RESPONSE_SHEET_NAME
    ) {
      logger.info(
        'Found trouble tickets sheet %s, pulling data in batches...',
        sheet.properties.title
      );
      for (const [rowStart, rowEnd] of getChunkIndexes(
        2, // 1-indexed and first row is headers.
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
          return;
        }
        logger.info('Pulled data from google, extracting...');
        extractTroubleTicketResponseRows(
          logger,
          data.right,
          collectEvents,
          initialMeta.right.properties.timeZone
        );
      }
    }
  }
  logger.info(
    'Found %s trouble ticket response events, caching...',
    events.length
  );
  await cacheTroubleTicketData(
    new Date(),
    troubleTicketSheetId,
    logger,
    events
  );
  logger.info('Finished caching trouble ticket response events');
};

let lastTroubleTicketSync: O.Option<DateTime> = O.none; // FIXME - Temporary for POC.

async function asyncApplyGoogleEvents(
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

      logger.info(
        'Pulling google training sheet data for least recently synced equipment'
      );
      // Temporarily try syncing just 1 piece of equipment at a time
      for (const equipment of getLeastRecentlySyncedEquipment(
        currentState,
        1
      )) {
        const equipmentLogger = logger.child({equipment});
        if (
          O.isNone(equipment.trainingSheetId) ||
          (O.isSome(equipment.lastQuizSync) &&
            Date.now() - equipment.lastQuizSync.value < googleRefreshIntervalMs)
        ) {
          equipmentLogger.info('No google training sheet refresh required');
          continue;
        }
        const equipmentTrainingSheetId = equipment.trainingSheetId.value;
        await startSpan(
          {
            name: 'Async Apply Google Events Equipment',
            attributes: {
              equipment_id: equipment.id,
              equipment_name: equipment.name,
              equipment_training_sheet_id: equipmentTrainingSheetId,
            },
          },
          async () => {
            equipmentLogger.info(
              'Triggering event update from google training sheets...'
            );

            const events: (
              | EventOfType<'EquipmentTrainingQuizSync'>
              | EventOfType<'EquipmentTrainingQuizResult'>
            )[] = [];
            const collectEvents = (
              event:
                | EventOfType<'EquipmentTrainingQuizSync'>
                | EventOfType<'EquipmentTrainingQuizResult'>
            ) => {
              events.push(event);
              updateState(event);
            };

            await pullNewEquipmentQuizResults(
              equipmentLogger,
              googleHelpers,
              equipment.id,
              equipmentTrainingSheetId,
              collectEvents
            );
            equipmentLogger.info(
              'Finished pulling %s events from google training sheet, caching...',
              events.length
            );
            await cacheSheetData(
              new Date(),
              equipmentTrainingSheetId,
              equipmentLogger,
              events
            );
          }
        );
      }
      logger.info('Finished pulling google training sheet data');
    }
  );
}

let lastRecurlySync: O.Option<DateTime> = O.none;
async function asyncApplyRecurlyEvents(
  logger: Logger,
  currentState: BetterSQLite3Database,
  updateState: (event: DomainEvent) => void,
  recurlyToken: string
) {
  if (
    O.isSome(lastRecurlySync) &&
    lastRecurlySync.value.diffNow().negate() < RECURLY_SYNC_INTERVAL
  ) {
    logger.info(
      'Skipping recurly sync, next sync in %s',
      RECURLY_SYNC_INTERVAL.minus(
        lastRecurlySync.value.diffNow().negate()
      ).toHuman()
    );
    return;
  }
  lastRecurlySync = O.some(DateTime.now());

  await startSpan(
    {
      name: 'Recurly Event Sync',
    },
    async () => {
      logger.info('Fetching recurly events...');
      const client = new recurly.Client(recurlyToken);

      const accounts = client.listAccounts();
      for await (const account of accounts.each()) {
        const {
          email,
          hasActiveSubscription,
          hasFutureSubscription,
          hasCanceledSubscription,
          hasPausedSubscription,
          hasPastDueInvoice,
        } = account;

        const maybeEmail = E.getOrElseW(() => undefined)(
          EmailAddressCodec.decode(email)
        );

        if (maybeEmail === undefined) {
          continue;
        }

        const event = constructEvent('RecurlySubscriptionUpdated')({
          email: maybeEmail,
          hasActiveSubscription: hasActiveSubscription ?? false,
          hasFutureSubscription: hasFutureSubscription ?? false,
          hasCanceledSubscription: hasCanceledSubscription ?? false,
          hasPausedSubscription: hasPausedSubscription ?? false,
          hasPastDueInvoice: hasPastDueInvoice ?? false,
        });

        updateState(event);
      }
    }
  );

  logger.info('...done');
}

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  updateState: (event: DomainEvent) => void,
  recurlyToken: O.Option<string>
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
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
  };
};
