import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as S from 'fp-ts/string';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as R from 'fp-ts/Record';
import * as O from 'fp-ts/Option';
import * as T from 'io-ts';
import {sequenceS} from 'fp-ts/lib/Apply';

import {Dependencies} from '../dependencies';
import {Logger} from 'pino';
import {Ord, contramap} from 'fp-ts/lib/Ord';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../types/failure-with-status';
import {accumBy, lastBy} from '../util';
import {QzEvent, QzEventDuplicate, RegEvent} from '../types/qz-event';
import {extractGoogleSheetData} from './google';
import {StatusCodes} from 'http-status-codes';
import {Failure} from '../types';
import {DateTime} from 'luxon';
import {sheets_v4} from '@googleapis/sheets';
import { Config } from '../configuration';

const byEquipmentId: Ord<RegEvent> = pipe(
  S.Ord,
  contramap((e: RegEvent) => e.equipmentId)
);

type PullSheetData = (
  logger: Logger,
  trainingSheetId: string
) => TE.TaskEither<Failure, sheets_v4.Schema$Spreadsheet>;

const getTrainingSheets = (events: ReadonlyArray<RegEvent>) =>
  pipe(
    events,
    RA.sortBy([byEquipmentId]),
    lastBy(event => event.equipmentId)
  );

const getPreviousQuizResultsByTrainingSheet = accumBy<string, QzEvent>(
  e => e.trainingSheetId
);

const processForEquipment = (
  logger: Logger,
  pullGoogleSheetData: PullSheetData,
  regEvent: RegEvent,
  existingQuizResults: ReadonlyArray<QzEvent>
): TE.TaskEither<FailureWithStatus, ReadonlyArray<QzEvent>> => {
  logger.info(
    `Scanning training sheet ${regEvent.trainingSheetId}. Pulling google sheet data...`
  );
  return pipe(
    pullGoogleSheetData(logger, regEvent.trainingSheetId),
    TE.mapBoth(
      failureWithStatus(
        'Failed to pull google sheet data',
        StatusCodes.INTERNAL_SERVER_ERROR
      ),
      data => {
        logger.trace(
          "Received data from google sheets for training sheet '{regEvent.trainingSheetId}': '%o'",
          data
        );
        return data;
      }
    ),
    TE.chainW(spreadsheet =>
      pipe(
        spreadsheet,
        extractGoogleSheetData(
          logger.child({trainingSheetId: regEvent.trainingSheetId}),
          regEvent.equipmentId,
          regEvent.trainingSheetId
        ),
        RA.map(events => {
          const newQuizResults =
            RA.difference(QzEventDuplicate)(existingQuizResults)(events);
          logger.info(
            `${newQuizResults.length} new quiz results after filtering`
          );
          return newQuizResults;
        }),
        RA.flatten,
        TE.right
      )
    )
  );
};

// FailureWithStatus probably isn't the type to be using as the 'error'.
const process =
  (logger: Logger, pullGoogleSheetData: PullSheetData) =>
  (
    sheetRegEvents: ReadonlyArray<RegEvent>,
    existingQuizResultEvents: ReadonlyArray<QzEvent>
  ): TE.TaskEither<FailureWithStatus, ReadonlyArray<QzEvent>> => {
    logger.info(
      'Got %d existing events, getting training sheets...',
      existingQuizResultEvents.length
    );
    const previousQuizResults = getPreviousQuizResultsByTrainingSheet(
      existingQuizResultEvents
    );
    return pipe(
      getTrainingSheets(sheetRegEvents),
      R.toEntries,
      sheets => {
        logger.info(`Got ${sheets.length} training sheets to scan...`);
        return sheets;
      },
      RA.map(([equipmentId, sheet]) =>
        processForEquipment(
          logger.child({equipment: equipmentId}),
          pullGoogleSheetData,
          sheet,
          previousQuizResults[sheet.trainingSheetId] ?? RA.empty
        )
      ),
      TE.sequenceArray,
      TE.chain(entries => TE.right(RA.flatten(entries)))
    );
  };

const processLegacyTrainingCompleteSheet= async (
  pullGoogleSheetData: PullSheetData,
  deps: Dependencies,
  logger: Logger,
): Promise<void> => {
  logger.info('Checking legacy training complete sheet for results...');
  const data = await pullGoogleSheetData(logger, deps)

    LEGACY_TRAINING_COMPLETE_SHEET
}

export const updateTrainingQuizResults = async (
  pullGoogleSheetData: PullSheetData,
  deps: Dependencies,
  logger: Logger,
  refreshCooldownMs: T.Int,
  legacyTrainingSheetId: string,
): Promise<void> => {
  try {
    if (deps.trainingQuizRefreshRunning) {
      logger.info(
        'Skipping running training quiz refresh as a job is already running'
      );
      return;
    }
    if (
      O.isSome(deps.lastTrainingQuizResultRefresh) &&
      deps.lastTrainingQuizResultRefresh.value.diffNow().negate().toMillis() <
        refreshCooldownMs
    ) {
      logger.info(
        `Skipping running training quiz refresh as a job was recently run '${deps.lastTrainingQuizResultRefresh.value.toString()}'`
      );
      return;
    }

    const start = performance.now();
    logger.info(
      'Running training sheets worker job...'
    );
    const newEvents = await pipe(
      {
        equipmentEvents:
          deps.getAllEventsByType<'EquipmentTrainingSheetRegistered'>(
            'EquipmentTrainingSheetRegistered'
          ),
        equipmentQuizEvents:
          deps.getAllEventsByType<'EquipmentTrainingQuizResult'>(
            'EquipmentTrainingQuizResult'
          ),
      },
      sequenceS(TE.ApplySeq),
      TE.chain(({equipmentEvents, equipmentQuizEvents}) =>
        process(logger, pullGoogleSheetData)(
          equipmentEvents,
          equipmentQuizEvents
        )
      )
    )();

    if (E.isLeft(newEvents)) {
      logger.error(newEvents.left, 'Failed to get training quiz results');
      return;
    }
    logger.info(
      `Finished getting training sheet quiz results, gathered: ${newEvents.right.length} results. Committing...`
    );

    for (const newEvent of newEvents.right) {
      pipe(
        await deps.commitEvent(
          {
            type: 'EquipmentTrainingQuizResult',
            id: newEvent.id,
          },
          'no-such-resource'
        )(newEvent)(),
        E.fold(
          (err: FailureWithStatus) => logger.error(err),
          success => logger.debug(success)
        )
      );
    }
    logger.info('Finished commiting training sheet quiz results');
    await processLegacyTrainingCompleteSheet(
      pullGoogleSheetData, deps, logger
    );
    logger.info('Finished processing legacy training complete sheet')
    logger.info(
      `Took ${Math.round(
        performance.now() - start
      )}ms to run training sheets worker job`
    );
  } finally {
    deps.trainingQuizRefreshRunning = false;
    deps.lastTrainingQuizResultRefresh = O.some(DateTime.utc());
  }
};
