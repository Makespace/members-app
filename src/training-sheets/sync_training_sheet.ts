import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import * as RA from 'fp-ts/ReadonlyArray';
import * as RR from 'fp-ts/ReadonlyRecord';
import {SyncWorkerDependencies} from './dependencies';
import {Logger} from 'pino';
import {
  GoogleHelpers,
  GoogleSpreadsheetDataForSheet,
} from './google/pull_sheet_data';
import {
  extractGoogleSheetMetadata,
  GoogleSheetMetadata,
  MAX_COLUMN_INDEX,
} from '../google/extract-metadata';
import {columnBoundsRequired, shouldPullFromSheet} from '../google/google';
import {SheetDataTable} from './google/sheet-data-table';
import {getChunkIndexes} from '../util';
import {pipe} from 'fp-ts/lib/function';
import {
  extractEmail,
  extractMemberNumber,
  extractScore,
  extractTimestamp,
} from '../google/util';
import {formatValidationErrors} from 'io-ts-reporters';

const ROW_BATCH_SIZE = 50;

export type SyncWorkerDependenciesGoogle = Omit<
  SyncWorkerDependencies,
  'google'
> & {
  google: GoogleHelpers;
};

const extractFromRow =
  (
    logger: Logger,
    metadata: GoogleSheetMetadata,
    trainingSheetId: string,
    timezone: string
  ) =>
  (
    row:
      | {
          values: {formattedValue: string}[] | undefined;
        }
      | Record<string, never>,
    rowIndex: number
  ): O.Option<SheetDataTable['rows'][0]> => {
    if (!row.values) {
      return O.none;
    }
    const email = O.isSome(metadata.mappedColumns.email)
      ? pipe(
          row.values,
          RA.lookup(metadata.mappedColumns.email.value),
          O.map(entry => entry.formattedValue),
          O.map(extractEmail),
          O.flatten
        )
      : O.none;
    const memberNumber = O.isSome(metadata.mappedColumns.memberNumber)
      ? pipe(
          row.values,
          RA.lookup(metadata.mappedColumns.memberNumber.value),
          O.map(entry => entry.formattedValue),
          O.map(extractMemberNumber),
          O.flatten
        )
      : O.none;
    const score = pipe(
      row.values,
      RA.lookup(metadata.mappedColumns.score),
      O.map(entry => entry.formattedValue),
      O.map(extractScore),
      O.flatten
    );
    const timestampEpochMS = pipe(
      RA.lookup(metadata.mappedColumns.timestamp)(row.values),
      O.map(entry => entry.formattedValue),
      O.getOrElse<string | null>(() => null),
      extractTimestamp(timezone).decode
    );

    if (O.isNone(email) && O.isNone(memberNumber)) {
      // Note that some quizes only require the member number.
      logger.warn(
        'Failed to extract email or member number from row, skipping quiz result'
      );
      logger.trace('Skipped quiz row: %O', row);
      return O.none;
    }
    if (O.isNone(score)) {
      logger.warn('Failed to extract score from row, skipped row');
      logger.trace('Skipped quiz row: %o', row);
      return O.none;
    }
    if (E.isLeft(timestampEpochMS)) {
      logger.warn(
        'Failed to extract timestamp from row, skipped row, reason: %s',
        formatValidationErrors(timestampEpochMS.left)
      );
      return O.none;
    }
    return O.some({
      sheet_id: trainingSheetId,
      sheet_name: metadata.name,
      row_index: rowIndex,
      member_number_provided: O.isSome(memberNumber)
        ? memberNumber.value
        : null,
      email_provided: O.isSome(email) ? email.value : null,
      score: score.value.score,
      max_score: score.value.maxScore,
      percentage: score.value.percentage,
      cached_at: new Date(),
    });
  };

const extractGoogleSheetData = (
  logger: Logger,
  trainingSheetId: string,
  metadata: GoogleSheetMetadata,
  timezone: string,
  spreadsheet: GoogleSpreadsheetDataForSheet,
  startRow: number
): ReadonlyArray<SheetDataTable['rows'][0]> =>
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
            metadata,
            trainingSheetId,
            timezone
          )(row, i + startRow)
        )
      );
    }),
    O.getOrElse<ReadonlyArray<SheetDataTable['rows'][0]>>(() => [])
  );

const pullTrainingSheetRows = async (
  log: Logger,
  google: GoogleHelpers,
  trainingSheetId: string,
  sheet: GoogleSheetMetadata,
  timezone: string,
  initialRowStart: number
): Promise<ReadonlyArray<SheetDataTable['rows'][0]>> => {
  log.info('Pulling training sheet rows starting at row %s', initialRowStart);
  const resultantRows: SheetDataTable['rows'][0][] = [];

  for (const [rowStart, rowEnd] of getChunkIndexes(
    initialRowStart,
    sheet.rowCount,
    ROW_BATCH_SIZE
  )) {
    log.debug('Pulling data for sheet rows %s to %s', rowStart, rowEnd);

    const [minCol, maxCol] = columnBoundsRequired(sheet);

    const data = await google.pullGoogleSheetData(
      log,
      trainingSheetId,
      sheet.name,
      rowStart,
      rowEnd,
      minCol,
      maxCol
    )();
    if (E.isLeft(data)) {
      log.error(
        data.left,
        'Failed to pull data for sheet rows %s to %s, skipping rest of sheet',
        rowStart,
        rowEnd
      );
      return resultantRows;
    }
    log.info('Pulled data from google, extracting...');
    resultantRows.push(
      ...extractGoogleSheetData(
        log,
        trainingSheetId,
        sheet,
        timezone,
        data.right,
        rowStart
      )
    );
  }
  return resultantRows;
};

export const syncTrainingSheet = async (
  log: Logger,
  deps: SyncWorkerDependenciesGoogle,
  trainingSheetId: string
) => {
  const storeSyncResult = await deps.storeSync(trainingSheetId, new Date())();
  if (E.isLeft(storeSyncResult)) {
    log.warn(`Failed to record sync time - ${storeSyncResult.left}`);
    return;
  }

  log.info('Syncing training sheet, getting meta data...');
  const initialMeta = await deps.google.pullGoogleSheetDataMetadata(
    log,
    trainingSheetId
  )();
  if (E.isLeft(initialMeta)) {
    log.warn(initialMeta.left);
    return;
  }

  log.info('Got meta data for sheet, scanning sheets within sheet...');

  const sheets: GoogleSheetMetadata[] = [];
  for (const sheet of initialMeta.right.sheets) {
    if (!shouldPullFromSheet(trainingSheetId, sheet)) {
      log.warn(
        "Skipping sheet '%s' as doesn't match expected for form responses",
        sheet.properties.title
      );
      continue;
    }

    const firstRowData = await deps.google.pullGoogleSheetData(
      log,
      trainingSheetId,
      sheet.properties.title,
      1,
      1,
      0,
      MAX_COLUMN_INDEX
    )();
    if (E.isLeft(firstRowData)) {
      log.warn(
        'Failed to get google sheet first row data for sheet %s, skipping',
        sheet.properties.title
      );
      continue;
    }

    const meta = extractGoogleSheetMetadata(log, sheet, firstRowData.right);
    if (O.isNone(meta)) {
      continue;
    }

    log.info(
      'Got metadata for sheet: %s: %o',
      sheet.properties.title,
      meta.value
    );
    sheets.push(meta.value);
  }

  log.info('Getting last row read...');

  const lastRowRead = await deps.lastRowRead(trainingSheetId)();

  if (E.isLeft(lastRowRead)) {
    log.warn('Failed to get last row read data');
    log.warn(lastRowRead.left);
    return;
  }

  log.info('Got last row read data: %o', lastRowRead);

  for (const sheet of sheets) {
    const sheetLog = log.child({sheet_name: sheet.name});
    const rows = await pullTrainingSheetRows(
      sheetLog,
      deps.google,
      trainingSheetId,
      sheet,
      initialMeta.right.properties.timeZone,
      O.getOrElse(() => 1)(RR.lookup(sheet.name)(lastRowRead.right)) + 1 // 1-indexed and first row is headers.
    );
    log.info(
      'Finished pulling training sheet rows, pulled %s new rows',
      rows.length
    );
    const rowsReadResult = await deps.storeRowsRead(rows)();
    if (E.isLeft(rowsReadResult)) {
      sheetLog.info(
        `Failed to store rows read: ${rowsReadResult.left}, continuing anyway...`
      );
    }
  }

  log.info('Finished processing training sheet');
};

export const syncEquipmentTrainingSheets = async (
  deps: SyncWorkerDependenciesGoogle
): Promise<void> => {
  const sheetsToSync = await deps.getSheetsToSync()();
  if (E.isLeft(sheetsToSync)) {
    deps.logger.error(`Failed to get sheets to sync: '${sheetsToSync.left}'`);
    return;
  }

  for (const [equipmentId, trainingSheetId] of sheetsToSync.right.entries()) {
    await syncTrainingSheet(
      deps.logger.child({equipmentId, trainingSheetId}),
      deps,
      trainingSheetId
    );
  }
};
