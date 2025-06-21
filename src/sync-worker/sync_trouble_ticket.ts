import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {SyncWorkerDependencies} from './dependencies';
import {Logger} from 'pino';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
  GoogleSpreadsheetInitialMetadata,
} from './google/pull_sheet_data';
import {TroubleTicketDataTable} from './google/sheet-data-table';
import {pipe} from 'fp-ts/lib/function';
import {extractTimestamp} from './google/util';
import {formatValidationErrors} from 'io-ts-reporters';
import {getChunkIndexes} from '../util';

const ROW_BATCH_SIZE = 50;
const EXPECTED_TROUBLE_TICKET_RESPONSE_SHEET_NAME = 'Form Responses 1';

export type SyncTroubleTicketDependencies = Pick<
  SyncWorkerDependencies,
  | 'logger'
  | 'storeSync'
  | 'lastSync'
  | 'storeTroubleTicketRowsRead'
  | 'lastTroubleTicketRowRead'
>;

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

const extractFromRow =
  (
    logger: Logger,
    sheetName: string,
    troubleTicketSheetId: string,
    timezone: string
  ) =>
  (
    row:
      | {
          values: {formattedValue: string}[] | undefined;
        }
      | Record<string, never>,
    rowIndex: number
  ): O.Option<TroubleTicketDataTable['rows'][0]> => {
    if (!row.values) {
      return O.none;
    }
    const _grabColumn = grabColumn(row.values);
    const timestamp = _grabColumn(0, extractTimestamp(timezone).decode);
    const email_address = _grabColumn(1, t.union([t.string, t.null]).decode);
    const which_equipment = _grabColumn(2, t.union([t.string, t.null]).decode);
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
      return O.none;
    }
    if (E.isLeft(email_address)) {
      validationErr('email address', email_address.left);
      return O.none;
    }
    if (E.isLeft(which_equipment)) {
      validationErr('which equipment', which_equipment.left);
      return O.none;
    }
    if (E.isLeft(name)) {
      validationErr('name', name.left);
      return O.none;
    }
    if (E.isLeft(membership_number)) {
      validationErr('membership number', membership_number.left);
      return O.none;
    }

    return O.some({
      sheet_id: troubleTicketSheetId,
      sheet_name: sheetName,
      row_index: rowIndex,
      response_submitted: timestamp.right,
      cached_at: new Date(),
      // Do not trust provided data - it is not verified.
      submitted_email: email_address.right,
      submitted_equipment: which_equipment.right,
      submitted_name: name.right,
      submitted_membership_number: membership_number.right,
      submitted_response_json: JSON.stringify(responses),
    });
  };

const extractTroubleTicketResponseRows = (
  logger: Logger,
  troubleTicketSheetId: string,
  sheetName: string,
  timezone: string,
  spreadsheet: GoogleSpreadsheetDataForSheet,
  startRow: number
): ReadonlyArray<TroubleTicketDataTable['rows'][0]> =>
  pipe(
    spreadsheet.sheets[0].data,
    A.lookup(0),
    O.flatMap(sheetData => O.fromNullable(sheetData.rowData)),
    O.map(data => {
      return pipe(
        data,
        RA.filterMapWithIndex((i, row) =>
          extractFromRow(
            logger,
            sheetName,
            troubleTicketSheetId,
            timezone
          )(row, i + startRow)
        )
      );
    }),
    O.getOrElse<ReadonlyArray<TroubleTicketDataTable['rows'][0]>>(() => [])
  );

const pullTroubleTicketRows = async (
  log: Logger,
  google: GoogleHelpers,
  troubleTicketSheetId: string,
  sheet: {
    properties: {
      title: string;
      gridProperties: {
        rowCount: number;
      };
    };
  },
  timezone: string,
  initialRowStart: number
): Promise<ReadonlyArray<TroubleTicketDataTable['rows'][0]>> => {
  log.info('Pulling trouble ticket rows starting at row %s', initialRowStart);
  const resultantRows: TroubleTicketDataTable['rows'][0][] = [];

  for (const [rowStart, rowEnd] of getChunkIndexes(
    initialRowStart,
    sheet.properties.gridProperties.rowCount,
    ROW_BATCH_SIZE
  )) {
    log.debug('Pulling trouble tickets rows %s to %s', rowStart, rowEnd);
    const [minCol, maxCol] = [0, 10]; // FIXME - Determine this dynamically.
    const data = await google.pullGoogleSheetData(
      log,
      troubleTicketSheetId,
      sheet.properties.title,
      rowStart,
      rowEnd,
      minCol,
      maxCol
    )();
    if (E.isLeft(data)) {
      log.error(
        data.left,
        'Failed to pull data for trouble ticket responses rows %s to %s, skipping rest of sheet',
        rowStart,
        rowEnd
      );
      return resultantRows;
    }
    log.info('Pulled data from google, extracting...');
    resultantRows.push(
      ...extractTroubleTicketResponseRows(
        log,
        troubleTicketSheetId,
        sheet.properties.title,
        timezone,
        data.right,
        rowStart
      )
    );
  }
  return resultantRows;
};

const shouldPullFromSheet = (
  sheet: GoogleSpreadsheetInitialMetadata['sheets'][0]
): boolean =>
  sheet.properties.title === EXPECTED_TROUBLE_TICKET_RESPONSE_SHEET_NAME;

const syncTroubleTicketSheet = async (
  log: Logger,
  deps: SyncTroubleTicketDependencies,
  google: GoogleHelpers,
  troubleTicketSheetId: string
): Promise<void> => {
  const storeSyncResult = await deps.storeSync(
    troubleTicketSheetId,
    new Date()
  )();
  if (E.isLeft(storeSyncResult)) {
    log.warn(`Failed to record sync time - ${storeSyncResult.left}`);
    return;
  }
  log.info('Syncing trouble ticket sheet, getting meta data...');
  const initialMeta = await google.pullGoogleSheetDataMetadata(
    log,
    troubleTicketSheetId
  )();
  if (E.isLeft(initialMeta)) {
    log.error(
      `Failed to get trouble ticket response sheet metadata. Not continuing: ${initialMeta.left}`
    );
    return;
  }

  log.info('Getting last row read...');

  const lastRowRead =
    await deps.lastTroubleTicketRowRead(troubleTicketSheetId)();

  if (E.isLeft(lastRowRead)) {
    log.warn('Failed to get last row read data');
    log.warn(lastRowRead.left);
    return;
  }

  log.info('Got last row read data: %o', lastRowRead.right);

  for (const sheet of initialMeta.right.sheets) {
    const sheetLog = log.child({sheet_name: sheet.properties.title});
    if (!shouldPullFromSheet(sheet)) {
      sheetLog.warn(
        "Skipping sheet '%s' as doesn't match expected for trouble tickets",
        sheet.properties.title
      );
      continue;
    }
    const rows = await pullTroubleTicketRows(
      sheetLog,
      google,
      troubleTicketSheetId,
      sheet,
      initialMeta.right.properties.timeZone,
      O.getOrElse(() => 1)(
        RR.lookup(sheet.properties.title)(lastRowRead.right)
      ) + 1 // 1-indexed and first row is headers.
    );
    log.info(
      'Finished pulling trouble sheet rows, pulled %s new rows',
      rows.length
    );
    const rowsReadResult = await deps.storeTroubleTicketRowsRead(rows)();
    if (E.isLeft(rowsReadResult)) {
      sheetLog.info(
        `Failed to store rows read: ${rowsReadResult.left}, continuing anyway...`
      );
    }
  }
  log.info('Finished processing trouble ticket sheet');
};

export const syncTroubleTickets = async (
  deps: SyncTroubleTicketDependencies,
  google: GoogleHelpers,
  troubleTicketSheetId: string,
  syncIntervalMs: number
): Promise<void> => {
  const log = deps.logger.child({troubleTicketSheetId});
  const lastSync = await deps.lastSync(troubleTicketSheetId)();
  if (
    E.isRight(lastSync) &&
    O.isSome(lastSync.right) &&
    Date.now() - lastSync.right.value.getTime() < syncIntervalMs
  ) {
    log.info(
      'Skipping trouble ticket sync as last sync was recent: %s',
      lastSync.right.value.toISOString()
    );
    return;
  }
  await syncTroubleTicketSheet(log, deps, google, troubleTicketSheetId);
};
