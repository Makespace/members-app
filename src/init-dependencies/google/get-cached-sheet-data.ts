// This could be generalised as another event store that is intentionally ephemeral but can be used to store other things.
// Lets see how well it works for sheet data and if it has value as an approach for other stuff.

import {Client} from '@libsql/client/.';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as tt from 'io-ts-types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import {DomainEvent} from '../../types/domain-event';
import {CachedDataTable} from './cached-data-table';
import {
  FailureWithStatus,
  failureWithStatus,
  internalCodecFailure,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {dbExecute} from '../../util';

// Note that this isn't automatically type safe. It does rely on the cached
// data actually being the type of DomainEvent we say it is.
const extractCachedEvents = <R>(
  rawCachedData: string
): t.Validation<ReadonlyArray<R>> =>
  pipe(
    rawCachedData,
    tt.JsonFromString.decode,
    E.chain(tt.JsonArray.decode),
    E.chain(t.readonlyArray(DomainEvent).decode),
    E.map(elements => elements as ReadonlyArray<R>)
  );

export const getCachedSheetData =
  <R>(dbClient: Client) =>
  (
    sheetId: string
  ): TE.TaskEither<
    FailureWithStatus,
    O.Option<{
      cached_at: Date;
      cached_data: t.Validation<ReadonlyArray<R>>;
    }>
  > =>
    pipe(
      TE.tryCatch(
        () =>
          dbExecute(
            // Currently we can do LIMIT 1 because we only expect each sheet to have a single entry within the cache sheet data
            dbClient,
            'SELECT * FROM cached_sheet_data WHERE sheet_id = $sheetId LIMIT 1',
            {
              sheetId,
            }
          ),
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
            cached_data: extractCachedEvents<R>(row.cached_data),
          })),
          RA.head
        )
      )
    );
