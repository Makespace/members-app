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
import {failure} from '../../types';
import {DomainEvent, EventOfType} from '../../types/domain-event';
import {CachedDataTable} from './cached-data-table';
import {
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

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
  () =>
    pipe(
      TE.tryCatch(
        () => dbClient.execute('SELECT * FROM cached_sheet_data'),
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
          RA.map(entry => ({
            ...entry,
            cached_data: extractCachedEvents(entry.cached_data),
          }))
        )
      )
    );

// This would be more efficient with a simple key-value store.
export const cacheSheetData =
  (dbClient: Client): Dependencies['cacheSheetData'] =>
  (
    cacheTimestamp: Date,
    sheetId: string,
    data: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizResult'>
      | EventOfType<'EquipmentTrainingQuizSync'>
    >
  ) =>
    TE.tryCatch(
      () =>
        dbClient
          .execute({
            sql: `
              INSERT INTO cached_sheet_data (cache_timestamp, sheet_id, cached_data)
              VALUES ($cacheTimestamp, $sheetId, $cachedData)
              ON CONFLICT (sheet_id) DO UPDATE SET
                cache_timestamp = excluded.cache_timestamp,
                cached_data = excluded.cached_data;
            `,
            args: {
              cacheTimestamp,
              sheetId,
              data: JSON.stringify(data),
            },
          })
          .then(() => {}),
      failure('Failed to insert cached sheet data')
    );
