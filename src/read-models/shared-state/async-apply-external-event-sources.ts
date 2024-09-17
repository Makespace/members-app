import {Logger} from 'pino';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, Failure} from '../../types';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {getAllEquipment} from './get-equipment';
import {pipe} from 'fp-ts/lib/function';
import {sheets_v4} from '@googleapis/sheets';
import {Equipment} from './return-types';
import {QzEvent} from '../../types/qz-event';
import {extractGoogleSheetData} from '../../training-sheets/google';
import {DateTime} from 'luxon';

const GOOGLE_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export type PullSheetData = (
  logger: Logger,
  trainingSheetId: string
) => TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet>;

export const pullNewEquipmentQuizResults = (
  logger: Logger,
  pullGoogleSheetData: PullSheetData,
  equipment: Equipment
): T.Task<ReadonlyArray<QzEvent>> => {
  if (O.isNone(equipment.trainingSheetId)) {
    logger.warn(
      'No training sheet registered for equipment %s, skipping training data ingestion',
      equipment.name
    );
    // eslint-disable-next-line @typescript-eslint/require-await
    return async () => [] as ReadonlyArray<QzEvent>;
  }
  const trainingSheetId = equipment.trainingSheetId.value;
  logger.info(
    `Scanning training sheet ${trainingSheetId}. Pulling google sheet data...`
  );
  return pipe(
    pullGoogleSheetData(logger, trainingSheetId),
    TE.map(
      extractGoogleSheetData(
        logger.child({trainingSheetId: trainingSheetId}),
        trainingSheetId,
        equipment.lastQuizResult,
      )
    ),
    TE.map(RA.flatten),
    // eslint-disable-next-line @typescript-eslint/require-await
    TE.getOrElse(err => async () => {
      logger.error(
        'Failed to receive data from google sheets for equipment %s training sheet %o: %s',
        equipment.name,
        equipment.trainingSheetId,
        err.message
      );
      return [] as ReadonlyArray<QzEvent>;
    })
  );
};

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  pullGoogleSheetData: PullSheetData,
  updateState: (event: DomainEvent) => void
) => {
  let lastGoogleUpdate: number | null;
  return () => async () => {
    logger.info('Applying external event sources...');
    if (
      lastGoogleUpdate === null ||
      Date.now() - lastGoogleUpdate > GOOGLE_UPDATE_INTERVAL_MS
    ) {
      logger.info('Triggering event update from google training sheets...');
      for (const equipment of getAllEquipment(currentState)()) {
        RA.map(updateState)(
          await pullNewEquipmentQuizResults(
            logger,
            pullGoogleSheetData,
            equipment
          )()
        );
        equipment.lastQuizSync = O.some(DateTime.utc());
      }
    }
    logger.info('Finished applying external event sources');
  };
};
