import {Client} from '@libsql/client/.';
import {Dependencies} from '../../dependencies';
import {flow, pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
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
): t.Validation<ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>> =>
  pipe(
    rawCachedData,
    tt.JsonFromString.decode,
    E.chain(tt.JsonArray.decode),
    E.chain(t.readonlyArray(DomainEvent).decode),
    E.map(
      elements =>
        elements as ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>
    )
  );

export const getCachedSheetData =
  (dbClient: Client): Dependencies['getCachedSheetData'] =>
  () =>
    pipe(
      TE.tryCatch(
        () => dbClient.execute('SELECT * FROM cachedSheetData'),
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

export const cacheSheetData =
  (dbClient: Client): Dependencies['cacheSheetData'] =>
  (
    cacheTimestamp: Date,
    sheetId: string,
    equipmentId: UUID,
    data: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>
  ) =>
    TE.tryCatch(
      () =>
        dbClient
          .execute({
            sql: 'INSERT INTO cached_sheet_data (cache_timestamp, sheet_id, equipment_id, cached_data) VALUES ($cacheTimestamp, $sheetId, $equipmentId, $cachedData)',
            args: {
              cacheTimestamp,
              sheetId,
              equipmentId,
              data: JSON.stringify(data),
            },
          })
          .then(() => {}),
      failure('Failed to insert cached sheet data')
    );
