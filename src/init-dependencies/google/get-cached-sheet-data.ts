// This could be generalised as another event store that is intentionally ephemeral but can be used to store other things.
// Lets see how well it works for sheet data and if it has value as an approach for other stuff.

import {Client} from '@libsql/client/.';
import {Dependencies} from '../../dependencies';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import {DomainEvent, EventOfType} from '../../types/domain-event';
import {CachedDataTable} from './cached-data-table';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {Logger} from 'pino';

const extractCachedEvents = (
  rawCachedData: string
): t.Validation<
  ReadonlyArray<
    | EventOfType<'EquipmentTrainingQuizResult'>
    | EventOfType<'EquipmentTrainingQuizSync'>
  >
> =>
  pipe(
    rawCachedData,
    tt.JsonFromString.decode,
    E.chain(tt.JsonArray.decode),
    E.chain(t.readonlyArray(DomainEvent).decode),
    E.map(
      elements =>
        elements as ReadonlyArray<
          | EventOfType<'EquipmentTrainingQuizResult'>
          | EventOfType<'EquipmentTrainingQuizSync'>
        >
    )
  );

export const getCachedSheetData =
  (dbClient: Client): Dependencies['getCachedSheetData'] =>
  (sheetId: string) =>
    pipe(
      TE.tryCatch(
        () =>
          dbClient.execute({
            // Currently we can do LIMIT 1 because we only expect each sheet to have a single entry within the cache sheet data
            sql: 'SELECT * FROM cached_sheet_data WHERE sheet_id = $sheetId LIMIT 1',
            args: {
              sheetId,
            },
          }),
        failureWithStatus(
          'Failed to get cached sheet data',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
      TE.chainEitherK(
        flow(
          CachedDataTable.decode,
          E.mapLeft(internalCodecFailure('Failed to decode cached sheet data'))
        )
      ),
      TE.map(table =>
        pipe(
          table.rows,
          RA.map(row => ({
            ...row,
            cached_data: extractCachedEvents(row.cached_data),
          })),
          RA.head
        )
      )
    );

// This would be more efficient with a simple key-value store.
export const cacheSheetData =
  (dbClient: Client): Dependencies['cacheSheetData'] =>
  async (
    cacheTimestamp: Date,
    sheetId: string,
    logger: Logger,
    data: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizResult'>
      | EventOfType<'EquipmentTrainingQuizSync'>
    >
  ) => {
    logger.info('Caching sheet data (%s entries)', data.length);
    const cachedData = JSON.stringify(data);
    logger.info('Cache data to insert length: %s', cachedData.length);
    await new Promise(res => setTimeout(res, 5000));
    try {
      await dbClient.execute({
        sql: `
              INSERT INTO cached_sheet_data (cached_at, sheet_id, cached_data)
              VALUES ($cachedAt, $sheetId, $cachedData)
              ON CONFLICT (sheet_id) DO UPDATE SET
                cached_at = excluded.cached_at,
                cached_data = excluded.cached_data;
            `,
        args: {
          cachedAt: cacheTimestamp,
          sheetId,
          cachedData,
        },
      });
    } catch (e) {
      logger.error(e, 'Failed to insert cache data, failing silently...');
    }
    // return TE.tryCatch(
    //   () =>
    //     dbClient.execute({

    //     }),
    //   failure('Failed to insert cached sheet data')
    // );
  };
