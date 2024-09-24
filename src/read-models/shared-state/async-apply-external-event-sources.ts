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
import {EpochTimestampMilliseconds, Equipment} from './return-types';
import {extractGoogleSheetData} from '../../training-sheets/google';
import {constructEvent, EventOfType} from '../../types/domain-event';

export type PullSheetData = (
  logger: Logger,
  trainingSheetId: string
) => TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet>;

export const pullNewEquipmentQuizResults = (
  logger: Logger,
  pullGoogleSheetData: PullSheetData,
  equipment: Equipment
): T.Task<
  ReadonlyArray<
    | EventOfType<'EquipmentTrainingQuizResult'>
    | EventOfType<'EquipmentTrainingQuizSync'>
  >
> => {
  if (O.isNone(equipment.trainingSheetId)) {
    logger.warn(
      'No training sheet registered for equipment %s, skipping training data ingestion',
      equipment.name
    );
    // eslint-disable-next-line @typescript-eslint/require-await
    return async () =>
      [] as ReadonlyArray<
        | EventOfType<'EquipmentTrainingQuizResult'>
        | EventOfType<'EquipmentTrainingQuizSync'>
      >;
  }
  const trainingSheetId = equipment.trainingSheetId.value;
  logger = logger.child({trainingSheetId});
  logger.info(
    'Scanning training sheet. Pulling google sheet data from %s...',
    equipment.lastQuizResult
  );
  return pipe(
    pullGoogleSheetData(logger, trainingSheetId),
    TE.map(
      extractGoogleSheetData(
        logger,
        trainingSheetId,
        equipment.id,
        equipment.lastQuizResult
      )
    ),
    TE.map(RA.flatten),
    TE.map(
      RA.append<
        | EventOfType<'EquipmentTrainingQuizResult'>
        | EventOfType<'EquipmentTrainingQuizSync'>
      >(
        constructEvent('EquipmentTrainingQuizSync')({
          equipmentId: equipment.id,
        })
      )
    ),
    // eslint-disable-next-line @typescript-eslint/require-await
    TE.getOrElse(err => async () => {
      logger.error(
        'Failed to receive data from google sheets for equipment %s: %s',
        equipment.name,
        err.message
      );
      return [] as ReadonlyArray<
        | EventOfType<'EquipmentTrainingQuizResult'>
        | EventOfType<'EquipmentTrainingQuizSync'>
      >;
    })
  );
};

export const asyncApplyExternalEventSources = (
  logger: Logger,
  currentState: BetterSQLite3Database,
  pullGoogleSheetData: O.Option<PullSheetData>,
  updateState: (event: DomainEvent) => void,
  googleRateLimitMs: number
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
    if (O.isNone(pullGoogleSheetData)) {
      logger.info('Google external event source disabled');
      return;
    }
    for (const equipment of getAllEquipment(currentState)()) {
      if (
        O.isSome(equipment.trainingSheetId) &&
        (O.isNone(equipment.lastQuizSync) ||
          (Date.now() as EpochTimestampMilliseconds) -
            equipment.lastQuizSync.value >
            googleRateLimitMs)
      ) {
        logger.info(
          'Triggering event update from google training sheets for %s...',
          equipment.name
        );
        pipe(
          await pullNewEquipmentQuizResults(
            logger,
            pullGoogleSheetData.value,
            equipment
          )(),
          RA.map(updateState)
        );
        logger.info(
          'Finished pulling events from google training sheet for %s',
          equipment.name
        );
      }
    }
    logger.info('Finished applying external event sources');
  };
};
