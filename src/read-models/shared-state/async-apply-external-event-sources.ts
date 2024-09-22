import {Logger} from 'pino';
import * as T from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
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
import {pullLegacyTrainedMembers} from '../../init-dependencies/google/legacy_trained_members';

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
  logger.info('Scanning training sheet. Pulling google sheet data...');
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
  pullGoogleSheetData: PullSheetData,
  updateState: (event: DomainEvent) => void,
  googleRateLimitMs: number,
  legacyTrainingSheetId: string
) => {
  return () => async () => {
    logger.info('Applying external event sources...');
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
            pullGoogleSheetData,
            equipment
          )(),
          RA.map(updateState)
        );
      }
    }
    pipe(
      await pullLegacyTrainedMembers(
        logger,
        currentState,
        legacyTrainingSheetId,
        pullGoogleSheetData
      )(),
      E.map(RA.map(updateState)),
      E.mapLeft(err =>
        logger.error(`Failed to pull legacy trained members: '${err.message}'`)
      )
    );
    logger.info('Finished applying external event sources');
  };
};
